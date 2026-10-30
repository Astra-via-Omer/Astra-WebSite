begin;
-- Preserve current tabs for existing members; new investors start with Overview only.
-- Role and tab access are Investor Room settings, not global Astra identity roles.
alter table public.astra_investor_members drop constraint if exists astra_investor_members_role_check;
alter table public.astra_investor_members add constraint astra_investor_members_role_check check(role in ('investor','power_user','admin'));
alter table public.astra_investor_members add column if not exists tab_access text[] not null default array['overview','documents','updates','questions'];
alter table public.astra_investor_members alter column tab_access set default array['overview'];
alter table public.astra_investor_members drop constraint if exists astra_investor_members_tab_access_check;
alter table public.astra_investor_members add constraint astra_investor_members_tab_access_check check(
 tab_access <@ array['overview','documents','updates','questions']::text[] and cardinality(tab_access)<=4 and array_position(tab_access,null) is null
);
comment on column public.astra_investor_members.tab_access is 'Approved content tabs for investors. Account is always available. Power users see all content tabs and published previews; management remains admin-only. Downloads require separate grants.';
-- The directory RPC returns setof astra_investor_members and automatically includes this column.
-- Existing RLS, server-only table grants, shared approvals, NDA records and document grants are unchanged.
notify pgrst,'reload schema';
commit;
