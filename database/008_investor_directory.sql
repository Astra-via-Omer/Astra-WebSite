begin;
-- Preserve memberships and audit references while keeping archived test
-- identities out of the normal investor administration screens.
create or replace function public.astra_investor_directory_members()
returns setof public.astra_investor_members
language sql stable security definer set search_path='' as $$
 select m.* from public.astra_investor_members m join auth.users u on u.id=m.user_id
 where u.deleted_at is null and coalesce(u.raw_app_meta_data->>'directory_archived','false')<>'true'
 order by m.email;
$$;
revoke all on function public.astra_investor_directory_members() from public,anon,authenticated;
grant execute on function public.astra_investor_directory_members() to service_role;
notify pgrst,'reload schema';
commit;
