-- Harden publication state: only the trusted publisher Edge Function (service_role)
-- may switch sites to published or replace the deployed HTML/URL.
begin;

drop policy if exists sites_insert_admin on public.sites;
create policy sites_insert_admin on public.sites
for insert to authenticated
with check (
  public.has_org_role(organization_id, array['owner','admin','staff'])
  and created_by = (select auth.uid())
  and status = 'draft'
  and cloudflare_project_name is null
  and cloudflare_deployment_id is null
  and published_url is null
  and published_at is null
);

-- Browser dashboard doesn't need direct UPDATE on the sites table.
-- The authenticated publish Edge Function verifies role and performs updates server-side.
revoke update on public.sites from authenticated;

commit;
