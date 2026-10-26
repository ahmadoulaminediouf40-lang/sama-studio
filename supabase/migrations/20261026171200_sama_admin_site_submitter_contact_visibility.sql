drop policy if exists "SAMA admins read profiles of submitted site owners" on public.profiles;
create policy "SAMA admins read profiles of submitted site owners"
on public.profiles
for select to authenticated
using (
  exists(select 1 from public.site_management_admins a where a.user_id=(select auth.uid()))
  and exists(
    select 1 from public.sites s
    left join public.organizations o on o.id=s.organization_id
    where s.submitted_at is not null
      and (s.created_by=profiles.id or o.owner_id=profiles.id)
  )
);
