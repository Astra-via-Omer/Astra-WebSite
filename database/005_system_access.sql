begin;
-- One shared account; separate approval for each Astra application.
create table if not exists public.astra_user_system_access (
 user_id uuid primary key references auth.users(id) on delete cascade,
 email text not null default '',
 workflow boolean not null default false,
 lab boolean not null default false,
 colossus boolean not null default false,
 enigma boolean not null default false,
 evidence boolean not null default false,
 investor_room boolean not null default false,
 updated_at timestamptz not null default now()
);
alter table public.astra_user_system_access add column if not exists investor_room boolean not null default false;
comment on column public.astra_user_system_access.investor_room is 'Investor Room approval; membership, expiry, NDA and document grants remain required.';
comment on table public.astra_user_system_access is 'System login approvals. Edit the application approval switches in Supabase Table Editor. Roles and account suspension remain separate. New accounts start with all systems off.';
comment on column public.astra_user_system_access.workflow is 'Workflow / Personal Workspace (workspace.astra-via.com)';
comment on column public.astra_user_system_access.evidence is 'Evidence Validation service';

create or replace function public.astra_system_access_admin() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users u where u.id=auth.uid()
  and u.raw_app_meta_data->>'role'='admin'
  and coalesce(u.raw_app_meta_data->>'disabled','false')<>'true'
  and coalesce(u.raw_app_meta_data->>'workspace_approved','true')<>'false'
  and coalesce(u.raw_app_meta_data->>'workspace_scope','full')<>'workflow'
  and (not (u.raw_app_meta_data ? 'system_access') or u.raw_app_meta_data#>'{system_access,workflow}'='true'::jsonb)
  and (u.banned_until is null or u.banned_until<=now()) and u.deleted_at is null);
$$;
revoke all on function public.astra_system_access_admin() from public,anon;
grant execute on function public.astra_system_access_admin() to authenticated;
alter table public.astra_user_system_access enable row level security;
revoke all on public.astra_user_system_access from anon,authenticated;
grant select on public.astra_user_system_access to authenticated;
grant update(workflow,lab,colossus,enigma,evidence,investor_room) on public.astra_user_system_access to authenticated;
grant all on public.astra_user_system_access to service_role;
drop policy if exists "Read system approvals" on public.astra_user_system_access;
create policy "Read system approvals" on public.astra_user_system_access for select to authenticated
 using(user_id=auth.uid() or public.astra_system_access_admin());
drop policy if exists "Admin updates system approvals" on public.astra_user_system_access;
create policy "Admin updates system approvals" on public.astra_user_system_access for update to authenticated
 using(public.astra_system_access_admin()) with check(public.astra_system_access_admin());

create or replace function public.astra_sync_system_access() returns trigger
language plpgsql security definer set search_path='' as $$
declare metadata jsonb; global_role text;
begin
 perform pg_catalog.pg_advisory_xact_lock(731024611);
 if tg_op='UPDATE' and new.user_id<>old.user_id then raise exception 'Account identity cannot change'; end if;
 select coalesce(u.raw_app_meta_data,'{}'::jsonb),coalesce(u.email,'') into metadata,new.email
 from auth.users u where u.id=new.user_id for update;
 if not found then raise exception 'User not found'; end if;
 global_role:=metadata->>'role';
 if (new.workflow or new.lab or new.colossus or new.enigma)
  and coalesce(global_role,'') not in ('admin','participant','reader','viewer') then
  raise exception 'Assign an Astra role before enabling this system'; end if;
 if tg_op='UPDATE' and old.workflow and not new.workflow and global_role='admin'
  and coalesce(metadata->>'disabled','false')<>'true'
  and coalesce(metadata->>'workspace_approved','true')<>'false'
  and coalesce(metadata->>'workspace_scope','full')<>'workflow'
  and exists(select 1 from auth.users u where u.id=new.user_id and (u.banned_until is null or u.banned_until<=now()) and u.deleted_at is null)
  and not exists(select 1 from auth.users u where u.id<>new.user_id
   and u.raw_app_meta_data->>'role'='admin'
   and coalesce(u.raw_app_meta_data->>'disabled','false')<>'true'
   and coalesce(u.raw_app_meta_data->>'workspace_approved','true')<>'false'
   and coalesce(u.raw_app_meta_data->>'workspace_scope','full')<>'workflow'
   and (not (u.raw_app_meta_data ? 'system_access') or u.raw_app_meta_data#>'{system_access,workflow}'='true'::jsonb)
   and (u.banned_until is null or u.banned_until<=now()) and u.deleted_at is null) then
  raise exception 'Keep at least one active admin with Workflow access'; end if;
 -- Mirror into protected metadata, including existing Lab/Colossus/Enigma gates.
 -- Preserve unrelated metadata and any explicit Lab role.
 metadata:=metadata||jsonb_build_object('system_access',coalesce(metadata->'system_access','{}'::jsonb)||jsonb_build_object(
  'workflow',new.workflow,'lab',new.lab,'colossus',new.colossus,'enigma',new.enigma,'evidence',new.evidence,'investor_room',new.investor_room));
 if not (metadata ? 'lab') or metadata#>'{lab,inherits_global_role}'='true'::jsonb then
  if new.lab then metadata:=metadata-'lab';
  else metadata:=metadata||jsonb_build_object('lab',jsonb_build_object('enabled',false,'inherits_global_role',true)); end if;
 else
  metadata:=metadata||jsonb_build_object('lab',(metadata->'lab')||jsonb_build_object('enabled',new.lab,'role',coalesce(metadata#>>'{lab,role}',global_role)));
 end if;
 metadata:=metadata||jsonb_build_object(
  'colossus',coalesce(metadata->'colossus','{}'::jsonb)||jsonb_build_object('enabled',new.colossus),
  'enigma',coalesce(metadata->'enigma','{}'::jsonb)||jsonb_build_object('enabled',new.enigma));
 update auth.users set raw_app_meta_data=metadata,updated_at=now() where id=new.user_id;
 new.updated_at:=now();
 return new;
end; $$;
revoke all on function public.astra_sync_system_access() from public,anon,authenticated;
drop trigger if exists astra_sync_system_access on public.astra_user_system_access;
create trigger astra_sync_system_access before insert or update on public.astra_user_system_access
 for each row execute function public.astra_sync_system_access();

-- Preserve current grants. Never automatically expand a prior restriction.
insert into public.astra_user_system_access(user_id,email,workflow,lab,colossus,enigma,evidence)
select u.id,coalesce(u.email,''),
 coalesce(u.raw_app_meta_data->>'role','') in ('admin','participant','reader','viewer')
  and coalesce(u.raw_app_meta_data->>'workspace_approved','true')<>'false'
  and (not (u.raw_app_meta_data ? 'system_access') or u.raw_app_meta_data#>'{system_access,workflow}'='true'::jsonb),
 coalesce(u.email_confirmed_at is not null and
  (case when u.raw_app_meta_data ? 'lab' then u.raw_app_meta_data#>'{lab,enabled}'='true'::jsonb
   and coalesce(u.raw_app_meta_data#>>'{lab,role}','') in ('admin','participant','reader','viewer')
   else coalesce(u.raw_app_meta_data->>'role','') in ('admin','participant','reader','viewer') end)
  and (not (u.raw_app_meta_data ? 'system_access') or u.raw_app_meta_data#>'{system_access,lab}'='true'::jsonb),false),
 coalesce(u.raw_app_meta_data->>'role','') in ('admin','participant','reader','viewer')
  and coalesce(u.raw_app_meta_data#>>'{colossus,enabled}','true')<>'false'
  and (not (u.raw_app_meta_data ? 'system_access') or u.raw_app_meta_data#>'{system_access,colossus}'='true'::jsonb),
 coalesce(u.raw_app_meta_data->>'role','') in ('admin','participant','reader','viewer')
  and coalesce(u.raw_app_meta_data#>>'{enigma,enabled}','true')<>'false'
  and (not (u.raw_app_meta_data ? 'system_access') or u.raw_app_meta_data#>'{system_access,enigma}'='true'::jsonb),
 not (u.raw_app_meta_data ? 'system_access') or u.raw_app_meta_data#>'{system_access,evidence}'='true'::jsonb
from auth.users u where u.deleted_at is null
on conflict(user_id) do nothing;

create or replace function public.astra_new_account_system_access() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 insert into public.astra_user_system_access(user_id,email) values(new.id,coalesce(new.email,''));
 return new;
end; $$;
revoke all on function public.astra_new_account_system_access() from public,anon,authenticated;
drop trigger if exists astra_new_account_system_access on auth.users;
create trigger astra_new_account_system_access after insert on auth.users
 for each row execute function public.astra_new_account_system_access();

-- A trusted invitation establishes shared-report access for a newly provisioned
-- guest. Later explicit revocations must stay revoked.
create or replace function public.astra_invited_guest_system_access() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.raw_app_meta_data->>'workspace_scope'='workflow'
  and coalesce(old.raw_app_meta_data->>'workspace_scope','full')<>'workflow'
  and new.raw_app_meta_data->>'role'='viewer'
  and new.raw_app_meta_data->>'workspace_approved'='false' then
  update public.astra_user_system_access set workflow=true where user_id=new.id and not workflow;
 end if;
 return new;
end; $$;
revoke all on function public.astra_invited_guest_system_access() from public,anon,authenticated;
drop trigger if exists astra_invited_guest_system_access on auth.users;
create trigger astra_invited_guest_system_access after update of raw_app_meta_data on auth.users
 for each row execute function public.astra_invited_guest_system_access();

create or replace function public.astra_can_access_system(p_system text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users u where u.id=auth.uid()
  and coalesce(u.raw_app_meta_data->>'disabled','false')<>'true'
  and (u.banned_until is null or u.banned_until<=now()) and u.deleted_at is null
  and p_system in ('workflow','lab','colossus','enigma','evidence','investor_room')
  and u.raw_app_meta_data->'system_access'->p_system='true'::jsonb);
$$;
revoke all on function public.astra_can_access_system(text) from public,anon;
grant execute on function public.astra_can_access_system(text) to authenticated;
-- Live database checks revoke access for existing JWTs and direct REST calls.
do $$ declare target text; system_key text; begin
 foreach target in array array['astra_ui_documents','astra_ui_jobs','ev_jobs','ev_reviews','ev_api_keys'] loop
  system_key:=case when target like 'ev_%' then 'evidence' else 'workflow' end;
  if to_regclass('public.'||target) is not null then
   execute format('drop policy if exists "astra system approval" on public.%I',target);
   execute format('create policy "astra system approval" on public.%I as restrictive for all to authenticated using (public.astra_can_access_system(%L)) with check (public.astra_can_access_system(%L))',target,system_key,system_key);
  end if;
 end loop;
end $$;
notify pgrst,'reload schema';
commit;
