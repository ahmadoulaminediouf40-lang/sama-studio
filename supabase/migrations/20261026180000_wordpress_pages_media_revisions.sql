-- WordPress-like site content: independent routes, cloud media metadata, and server-side revisions.
begin;

create table if not exists public.site_pages (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null,
  organization_id uuid not null,
  title text not null check (char_length(trim(title)) between 1 and 120),
  slug text not null check (slug ~ '^[a-z0-9][a-z0-9-]{0,78}[a-z0-9]$' or slug = 'home'),
  content jsonb not null default '{}'::jsonb,
  seo_title text not null default '' check (char_length(seo_title) <= 70),
  seo_description text not null default '' check (char_length(seo_description) <= 170),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  menu_order integer not null default 0 check (menu_order between 0 and 10000),
  show_in_menu boolean not null default true,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  foreign key (site_id, organization_id) references public.sites(id, organization_id) on delete cascade,
  unique (site_id, slug),
  unique (id, site_id, organization_id)
);

create index if not exists site_pages_public_routes_idx
  on public.site_pages(site_id, status, slug);
create index if not exists site_pages_menu_idx
  on public.site_pages(site_id, show_in_menu, menu_order);

drop trigger if exists site_pages_set_updated_at on public.site_pages;
create trigger site_pages_set_updated_at before update on public.site_pages
for each row execute function public.set_updated_at();

create table if not exists public.site_revisions (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null,
  organization_id uuid not null,
  label text not null default 'Version sauvegardée' check (char_length(label) <= 120),
  snapshot jsonb not null,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (site_id, organization_id) references public.sites(id, organization_id) on delete cascade
);
create index if not exists site_revisions_history_idx
  on public.site_revisions(site_id, created_at desc);

create table if not exists public.site_media_assets (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null,
  organization_id uuid not null,
  storage_path text not null unique,
  original_name text not null check (char_length(original_name) between 1 and 255),
  mime_type text not null check (mime_type in ('image/png','image/jpeg','image/webp','image/gif','image/avif','image/svg+xml')),
  byte_size bigint not null check (byte_size between 1 and 20971520),
  alt_text text not null default '' check (char_length(alt_text) <= 250),
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (site_id, organization_id) references public.sites(id, organization_id) on delete cascade
);
create index if not exists site_media_assets_site_idx
  on public.site_media_assets(site_id, created_at desc);

alter table public.site_pages enable row level security;
alter table public.site_revisions enable row level security;
alter table public.site_media_assets enable row level security;

drop policy if exists site_pages_owner_select on public.site_pages;
create policy site_pages_owner_select on public.site_pages
for select to authenticated
using (public.has_org_role(organization_id, array['owner','admin']::text[]));
drop policy if exists site_pages_owner_insert on public.site_pages;
create policy site_pages_owner_insert on public.site_pages
for insert to authenticated
with check (
  public.has_org_role(organization_id, array['owner','admin']::text[])
  and created_by = (select auth.uid())
);
drop policy if exists site_pages_owner_update on public.site_pages;
create policy site_pages_owner_update on public.site_pages
for update to authenticated
using (public.has_org_role(organization_id, array['owner','admin']::text[]))
with check (public.has_org_role(organization_id, array['owner','admin']::text[]));
drop policy if exists site_pages_owner_delete on public.site_pages;
create policy site_pages_owner_delete on public.site_pages
for delete to authenticated
using (public.has_org_role(organization_id, array['owner','admin']::text[]));
drop policy if exists site_pages_public_published_read on public.site_pages;
create policy site_pages_public_published_read on public.site_pages
for select to anon, authenticated
using (
  status = 'published'
  and exists (
    select 1 from public.sites s
    where s.id = site_pages.site_id
      and s.organization_id = site_pages.organization_id
      and s.status = 'published'
  )
);

drop policy if exists site_revisions_owner_select on public.site_revisions;
create policy site_revisions_owner_select on public.site_revisions
for select to authenticated
using (public.has_org_role(organization_id, array['owner','admin']::text[]));
drop policy if exists site_revisions_owner_insert on public.site_revisions;
create policy site_revisions_owner_insert on public.site_revisions
for insert to authenticated
with check (
  public.has_org_role(organization_id, array['owner','admin']::text[])
  and created_by = (select auth.uid())
);
drop policy if exists site_revisions_owner_delete on public.site_revisions;
create policy site_revisions_owner_delete on public.site_revisions
for delete to authenticated
using (public.has_org_role(organization_id, array['owner','admin']::text[]));

drop policy if exists site_media_owner_select on public.site_media_assets;
create policy site_media_owner_select on public.site_media_assets
for select to authenticated
using (public.has_org_role(organization_id, array['owner','admin']::text[]));
drop policy if exists site_media_public_published_read on public.site_media_assets;
create policy site_media_public_published_read on public.site_media_assets
for select to anon, authenticated
using (
  exists (
    select 1 from public.sites s
    where s.id = site_media_assets.site_id
      and s.organization_id = site_media_assets.organization_id
      and s.status = 'published'
  )
);
drop policy if exists site_media_owner_insert on public.site_media_assets;
create policy site_media_owner_insert on public.site_media_assets
for insert to authenticated
with check (
  public.has_org_role(organization_id, array['owner','admin']::text[])
  and created_by = (select auth.uid())
);
drop policy if exists site_media_owner_update on public.site_media_assets;
create policy site_media_owner_update on public.site_media_assets
for update to authenticated
using (public.has_org_role(organization_id, array['owner','admin']::text[]))
with check (public.has_org_role(organization_id, array['owner','admin']::text[]));
drop policy if exists site_media_owner_delete on public.site_media_assets;
create policy site_media_owner_delete on public.site_media_assets
for delete to authenticated
using (public.has_org_role(organization_id, array['owner','admin']::text[]));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-media', 'site-media', false, 20971520,
  array['image/png','image/jpeg','image/webp','image/gif','image/avif'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists site_media_storage_owner_read on storage.objects;
create policy site_media_storage_owner_read on storage.objects
for select to authenticated
using (
  bucket_id = 'site-media'
  and array_length(storage.foldername(name), 1) >= 2
  and public.has_org_role((storage.foldername(name))[1]::uuid, array['owner','admin']::text[])
  and exists (
    select 1 from public.sites s
    where s.id = (storage.foldername(name))[2]::uuid
      and s.organization_id = (storage.foldername(name))[1]::uuid
  )
);
drop policy if exists site_media_storage_owner_insert on storage.objects;
create policy site_media_storage_owner_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'site-media'
  and array_length(storage.foldername(name), 1) >= 2
  and public.has_org_role((storage.foldername(name))[1]::uuid, array['owner','admin']::text[])
  and exists (
    select 1 from public.sites s
    where s.id = (storage.foldername(name))[2]::uuid
      and s.organization_id = (storage.foldername(name))[1]::uuid
  )
);
drop policy if exists site_media_storage_owner_update on storage.objects;
create policy site_media_storage_owner_update on storage.objects
for update to authenticated
using (
  bucket_id = 'site-media'
  and array_length(storage.foldername(name), 1) >= 2
  and public.has_org_role((storage.foldername(name))[1]::uuid, array['owner','admin']::text[])
  and exists (
    select 1 from public.sites s
    where s.id = (storage.foldername(name))[2]::uuid
      and s.organization_id = (storage.foldername(name))[1]::uuid
  )
)
with check (
  bucket_id = 'site-media'
  and array_length(storage.foldername(name), 1) >= 2
  and public.has_org_role((storage.foldername(name))[1]::uuid, array['owner','admin']::text[])
  and exists (
    select 1 from public.sites s
    where s.id = (storage.foldername(name))[2]::uuid
      and s.organization_id = (storage.foldername(name))[1]::uuid
  )
);
drop policy if exists site_media_storage_owner_delete on storage.objects;
create policy site_media_storage_owner_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'site-media'
  and array_length(storage.foldername(name), 1) >= 2
  and public.has_org_role((storage.foldername(name))[1]::uuid, array['owner','admin']::text[])
  and exists (
    select 1 from public.sites s
    where s.id = (storage.foldername(name))[2]::uuid
      and s.organization_id = (storage.foldername(name))[1]::uuid
  )
);

commit;