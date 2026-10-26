drop policy if exists sites_update_admin on public.sites;

create policy sites_update_admin
on public.sites
for update to authenticated
using (has_org_role(organization_id, array['owner','admin']))
with check (has_org_role(organization_id, array['owner','admin']));
