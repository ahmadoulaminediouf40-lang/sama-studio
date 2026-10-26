create table if not exists public.site_management_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  site_id uuid not null,
  requested_by uuid not null references auth.users(id) on delete cascade,
  message text not null default '' check (char_length(message) <= 1200),
  status text not null default 'pending'
    check (status in ('pending','accepted','in_progress','completed','declined','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  handled_at timestamptz,
  constraint site_management_requests_site_org_fkey
    foreign key (site_id, organization_id)
    references public.sites(id, organization_id) on delete cascade
);

create index if not exists site_management_requests_org_status_idx
  on public.site_management_requests(organization_id, status, created_at desc);
create index if not exists site_management_requests_site_idx
  on public.site_management_requests(site_id);

alter table public.site_management_requests enable row level security;
revoke all on table public.site_management_requests from anon, authenticated;
grant select, insert, update on table public.site_management_requests to authenticated;

create policy "Owners can read site management requests"
on public.site_management_requests
for select to authenticated
using (
  exists (
    select 1 from public.organization_memberships m
    where m.organization_id = site_management_requests.organization_id
      and m.user_id = (select auth.uid())
      and m.role in ('owner','admin')
  )
);

create policy "Owners can request site management"
on public.site_management_requests
for insert to authenticated
with check (
  requested_by = (select auth.uid())
  and status = 'pending'
  and exists (
    select 1 from public.organization_memberships m
    where m.organization_id = site_management_requests.organization_id
      and m.user_id = (select auth.uid())
      and m.role in ('owner','admin')
  )
  and exists (
    select 1 from public.sites s
    where s.id = site_management_requests.site_id
      and s.organization_id = site_management_requests.organization_id
  )
);

create policy "Requesters can cancel pending site management requests"
on public.site_management_requests
for update to authenticated
using (
  requested_by = (select auth.uid())
  and status = 'pending'
  and exists (
    select 1 from public.organization_memberships m
    where m.organization_id = site_management_requests.organization_id
      and m.user_id = (select auth.uid())
      and m.role in ('owner','admin')
  )
)
with check (
  requested_by = (select auth.uid())
  and status = 'cancelled'
  and exists (
    select 1 from public.organization_memberships m
    where m.organization_id = site_management_requests.organization_id
      and m.user_id = (select auth.uid())
      and m.role in ('owner','admin')
  )
);
