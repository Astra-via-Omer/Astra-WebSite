begin;
-- Durable, atomic limits shared by every server instance. No raw IP addresses
-- or unrecognized email addresses are retained here; keys are server HMACs.
create table if not exists public.astra_investor_reset_limits (
 key text primary key, started_at timestamptz not null, last_at timestamptz not null,
 requests integer not null check(requests > 0)
);
alter table public.astra_investor_reset_limits enable row level security;
revoke all on public.astra_investor_reset_limits from public,anon,authenticated,service_role;

create or replace function public.astra_investor_reserve_reset(p_email text,p_email_key text,p_network_key text)
returns table(user_id uuid,email text)
language plpgsql security definer set search_path='' as $$
declare k text; cap integer; counter public.astra_investor_reset_limits%rowtype;
begin
 if length(p_email)>254 or p_email_key !~ '^email:[a-f0-9]{64}$' or p_network_key !~ '^network:[a-f0-9]{64}$' or p_email is null or p_email_key is null or p_network_key is null then
  raise exception 'Invalid reset request';
 end if;
 -- Serialize reservation, including the global cap, so concurrent instances
 -- cannot exceed limits. Only the service-role endpoint can execute this RPC.
 perform pg_catalog.pg_advisory_xact_lock(719401807);
 delete from public.astra_investor_reset_limits where started_at < now()-interval '2 hours';
 foreach k in array array['global',p_network_key,p_email_key] loop
  cap := case when k='global' then 120 when k=p_network_key then 20 else 3 end;
  select * into counter from public.astra_investor_reset_limits where key=k;
  if found and counter.started_at > now()-interval '1 hour' and
   (counter.requests>=cap or (k=p_email_key and counter.last_at>now()-interval '90 seconds')) then return; end if;
 end loop;
 foreach k in array array['global',p_network_key,p_email_key] loop
  insert into public.astra_investor_reset_limits(key,started_at,last_at,requests) values(k,now(),now(),1)
  on conflict(key) do update set
   requests=case when astra_investor_reset_limits.started_at<=now()-interval '1 hour' then 1 else astra_investor_reset_limits.requests+1 end,
   started_at=case when astra_investor_reset_limits.started_at<=now()-interval '1 hour' then now() else astra_investor_reset_limits.started_at end,
   last_at=now();
 end loop;
 return query select u.id,u.email::text from auth.users u
 join public.astra_user_system_access a on a.user_id=u.id and a.investor_room
 join public.astra_investor_members m on m.user_id=u.id
 where lower(u.email)=lower(p_email) and u.deleted_at is null and u.email_confirmed_at is not null
 and (u.banned_until is null or u.banned_until<=now())
 and coalesce(u.raw_app_meta_data->>'disabled','false')<>'true'
 and (m.expires_at is null or m.expires_at>now()) limit 1;
end $$;
revoke all on function public.astra_investor_reserve_reset(text,text,text) from public,anon,authenticated;
grant execute on function public.astra_investor_reserve_reset(text,text,text) to service_role;
notify pgrst,'reload schema';
commit;
