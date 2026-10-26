drop policy if exists "SAMA managers can view organizations requesting support" on public.organizations;
create policy "SAMA managers can view organizations requesting support"
on public.organizations
for select to authenticated
using (
  exists (
    select 1 from public.site_management_admins a
    where a.user_id = (select auth.uid())
  )
  and exists (
    select 1 from public.site_management_requests r
    where r.organization_id = organizations.id
      and r.status in ('pending','accepted','in_progress')
  )
);

drop policy if exists "SAMA managers can view sites requesting support" on public.sites;
create policy "SAMA managers can view sites requesting support"
on public.sites
for select to authenticated
using (
  exists (
    select 1 from public.site_management_admins a
    where a.user_id = (select auth.uid())
  )
  and exists (
    select 1 from public.site_management_requests r
    where r.site_id = sites.id
      and r.organization_id = sites.organization_id
      and r.status in ('pending','accepted','in_progress')
  )
);
