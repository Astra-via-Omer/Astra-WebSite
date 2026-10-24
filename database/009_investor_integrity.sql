begin;
-- Freeze each published agreement. A snapshot of the pre-migration current text
-- is labeled as such; it does not certify the text accepted historically.
create table if not exists public.astra_investor_nda_versions (
 version text primary key, nda_text text not null,
 sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
 published_at timestamptz not null, published_by uuid,
 captured_at timestamptz not null default now(), legacy_snapshot boolean not null default false
);
alter table public.astra_investor_nda_versions enable row level security;
revoke all on public.astra_investor_nda_versions from public,anon,authenticated,service_role;
grant select on public.astra_investor_nda_versions to service_role;
create or replace function public.astra_investor_immutable_nda() returns trigger
language plpgsql set search_path='' as $$ begin raise exception 'Published NDA versions are immutable'; end; $$;
revoke all on function public.astra_investor_immutable_nda() from public,anon,authenticated;
drop trigger if exists astra_investor_immutable_nda on public.astra_investor_nda_versions;
create trigger astra_investor_immutable_nda before update or delete on public.astra_investor_nda_versions
 for each row execute function public.astra_investor_immutable_nda();

alter table public.astra_investor_settings add column if not exists nda_sha256 text;
alter table public.astra_investor_settings add column if not exists nda_published_by uuid;
alter table public.astra_investor_members add column if not exists nda_sha256 text;
insert into public.astra_investor_nda_versions(version,nda_text,sha256,published_at,legacy_snapshot)
 select nda_version,nda_text,encode(sha256(convert_to(nda_text,'UTF8')),'hex'),updated_at,true
 from public.astra_investor_settings where nda_version<>'' and nda_text<>''
 on conflict(version) do nothing;
create or replace function public.astra_investor_publish_nda() returns trigger
language plpgsql security definer set search_path='' as $$
declare existing public.astra_investor_nda_versions%rowtype;
begin
 if new.nda_version='' and new.nda_text='' then new.nda_sha256:=null; return new; end if;
 if new.nda_version='' or new.nda_text='' then raise exception 'Supply an NDA version and text'; end if;
 new.nda_sha256:=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(new.nda_text,'UTF8')),'hex');
 insert into public.astra_investor_nda_versions(version,nda_text,sha256,published_at,published_by)
 values(new.nda_version,new.nda_text,new.nda_sha256,now(),new.nda_published_by) on conflict(version) do nothing;
 select * into existing from public.astra_investor_nda_versions where version=new.nda_version;
 if existing.nda_text<>new.nda_text or existing.sha256<>new.nda_sha256 then raise exception 'Publish a new version to change NDA text'; end if;
 return new;
end; $$;
revoke all on function public.astra_investor_publish_nda() from public,anon,authenticated;
drop trigger if exists astra_investor_publish_nda on public.astra_investor_settings;
create trigger astra_investor_publish_nda before insert or update on public.astra_investor_settings
 for each row execute function public.astra_investor_publish_nda();
update public.astra_investor_settings set nda_text=nda_text;
create or replace function public.astra_investor_accept_nda_hash() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.nda_version is not null and (tg_op='INSERT' or new.nda_version is distinct from old.nda_version or new.nda_accepted_at is distinct from old.nda_accepted_at) then
  select sha256 into new.nda_sha256 from public.astra_investor_nda_versions where version=new.nda_version;
  if new.nda_sha256 is null then raise exception 'Published NDA version is required'; end if;
 end if;
 return new;
end; $$;
revoke all on function public.astra_investor_accept_nda_hash() from public,anon,authenticated;
drop trigger if exists astra_investor_accept_nda_hash on public.astra_investor_members;
create trigger astra_investor_accept_nda_hash before insert or update on public.astra_investor_members
 for each row execute function public.astra_investor_accept_nda_hash();
-- Do not invent acceptance hashes for existing investors. The app requests a
-- fresh acceptance when a member has no hash for the frozen current version.

create table if not exists public.astra_investor_room_visits (
 user_id uuid not null, session_hash text not null check(session_hash ~ '^[a-f0-9]{64}$'),
 first_opened_at timestamptz not null default now(), primary key(user_id,session_hash)
);
alter table public.astra_investor_room_visits enable row level security;
revoke all on public.astra_investor_room_visits from public,anon,authenticated,service_role;
create or replace function public.astra_investor_record_room_open(p_user_id uuid,p_email text,p_session_hash text) returns void
language plpgsql security definer set search_path='' as $$
declare inserted integer;
begin
 insert into public.astra_investor_room_visits(user_id,session_hash) values(p_user_id,p_session_hash) on conflict do nothing;
 get diagnostics inserted=row_count;
 if inserted=1 then insert into public.astra_investor_events(actor_id,actor_email,action) values(p_user_id,p_email,'room_opened'); end if;
end; $$;
revoke all on function public.astra_investor_record_room_open(uuid,text,text) from public,anon,authenticated;
grant execute on function public.astra_investor_record_room_open(uuid,text,text) to service_role;
-- Product admins keep their ordinary app approvals. Investor approval changes
-- belong to the verified investor administration backend only.
revoke update(investor_room) on public.astra_user_system_access from authenticated;
notify pgrst,'reload schema';
commit;
