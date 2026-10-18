begin;
-- Apply after Astra's shared 005_system_access.sql. Existing approvals are retained.
alter table public.astra_user_system_access add column if not exists investor_room boolean not null default false;
grant update(investor_room) on public.astra_user_system_access to authenticated;
comment on column public.astra_user_system_access.investor_room is 'Investor Room approval. Membership, expiry, NDA and document grants are also required.';

create table if not exists public.astra_investor_members (
 user_id uuid primary key references auth.users(id) on delete cascade,
 email text not null, role text not null default 'investor' check(role in ('investor','admin')),
 organization text not null default '', expires_at timestamptz,
 stage text not null default 'invited' check(stage in ('invited','reviewing','follow-up','committed','closed')),
 nda_version text, nda_accepted_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.astra_investor_settings (
 id boolean primary key default true check(id), nda_text text not null default '', nda_version text not null default '', updated_at timestamptz not null default now()
);
insert into public.astra_investor_settings(id) values(true) on conflict do nothing;
create table if not exists public.astra_investor_documents (
 id uuid primary key, title text not null, category text not null,
 version text not null, description text not null default '',
 object_path text not null unique, sha256 text not null, pages integer not null check(pages between 1 and 200),
 bytes integer not null check(bytes>0), published boolean not null default false,
 created_at timestamptz not null default now()
);
create table if not exists public.astra_investor_grants (
 user_id uuid not null references public.astra_investor_members(user_id) on delete cascade,
 document_id uuid not null references public.astra_investor_documents(id),
 can_view boolean not null default false, can_download boolean not null default false,
 primary key(user_id,document_id), check(not can_download or can_view)
);
create table if not exists public.astra_investor_events (
 id uuid primary key default gen_random_uuid(), occurred_at timestamptz not null default now(),
 actor_id uuid, actor_email text not null, action text not null,
 document_id uuid, copy_id uuid, details jsonb not null default '{}'::jsonb
);
create index if not exists astra_investor_events_time on public.astra_investor_events(occurred_at desc,id);
create table if not exists public.astra_investor_questions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
 email text not null, question text not null, answer text not null default '',
 created_at timestamptz not null default now(), answered_at timestamptz
);
create table if not exists public.astra_investor_shares (
 id uuid primary key default gen_random_uuid(), sender_id uuid not null references auth.users(id), sender_email text not null,
 recipient_email text not null, document_id uuid not null references public.astra_investor_documents(id),
 status text not null default 'pending' check(status in ('pending','approved','declined')),
 created_at timestamptz not null default now()
);
-- All investor data is accessed through the verified server. No direct browser
-- REST, GraphQL, or RPC access, including by ordinary Workspace admins.
do $$ declare t text; begin
 foreach t in array array['astra_investor_members','astra_investor_settings','astra_investor_documents','astra_investor_grants','astra_investor_events','astra_investor_questions','astra_investor_shares'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select,insert,update on public.%I to service_role',t);
 end loop;
end $$;
revoke update on public.astra_investor_events from service_role;
create or replace function public.astra_investor_immutable_audit() returns trigger
language plpgsql set search_path='' as $$ begin raise exception 'Investor audit events are append-only'; end; $$;
revoke all on function public.astra_investor_immutable_audit() from public,anon,authenticated;
drop trigger if exists astra_investor_immutable_audit on public.astra_investor_events;
create trigger astra_investor_immutable_audit before update or delete on public.astra_investor_events for each row execute function public.astra_investor_immutable_audit();

-- Runs AFTER the existing shared BEFORE trigger so older application migrations
-- cannot erase this new approval from the protected metadata mirror.
create or replace function public.astra_investor_sync_approval() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 update auth.users set raw_app_meta_data=jsonb_set(coalesce(raw_app_meta_data,'{}'::jsonb),'{system_access}',
  coalesce(raw_app_meta_data->'system_access','{}'::jsonb)||jsonb_build_object('investor_room',new.investor_room)),updated_at=now() where id=new.user_id;
 if tg_op='INSERT' or new.investor_room is distinct from old.investor_room then
  insert into public.astra_investor_events(actor_id,actor_email,action,details)
  values(auth.uid(),coalesce((select email from auth.users where id=auth.uid()),'trusted-server'),'approval_changed',jsonb_build_object('user_id',new.user_id,'approved',new.investor_room));
 end if;
 return new;
end $$;
revoke all on function public.astra_investor_sync_approval() from public,anon,authenticated;
drop trigger if exists astra_investor_sync_approval on public.astra_user_system_access;
create trigger astra_investor_sync_approval after insert or update on public.astra_user_system_access for each row execute function public.astra_investor_sync_approval();
-- Existing accounts remain blocked. Updating another system preserves the flag.
update public.astra_user_system_access set investor_room=investor_room;

create or replace function public.astra_investor_find_user(p_email text) returns table(user_id uuid,email text)
language sql stable security definer set search_path='' as $$ select id,email from auth.users where lower(email)=lower(p_email) and deleted_at is null limit 1 $$;
revoke all on function public.astra_investor_find_user(text) from public,anon,authenticated;
grant execute on function public.astra_investor_find_user(text) to service_role;
notify pgrst,'reload schema';
commit;
