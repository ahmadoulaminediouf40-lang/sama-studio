-- SaaS account activation, site review workflow and application-level storage quotas.
create table if not exists public.saas_plans (
  plan_code text primary key,
  display_name text not null,
  max_sites integer not null check (max_sites > 0),
  max_products integer not null check (max_products > 0),
  max_site_html_bytes integer not null check (max_site_html_bytes > 0),
  max_total_site_html_bytes bigint not null check (max_total_site_html_bytes > 0),
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);
insert into public.saas_plans(plan_code,display_name,max_sites,max_products,max_site_html_bytes,max_total_site_html_bytes,is_public)
values
 ('free','Découverte',1,25,1500000,2000000,true),
 ('starter','Essentiel',3,100,2500000,6000000,true),
 ('pro','Professionnel',10,500,2900000,20000000,true)
on conflict (plan_code) do update set
 display_name=excluded.display_name,max_sites=excluded.max_sites,max_products=excluded.max_products,
 max_site_html_bytes=excluded.max_site_html_bytes,max_total_site_html_bytes=excluded.max_total_site_html_bytes,is_public=excluded.is_public;

grant select on public.saas_plans to authenticated;
alter table public.saas_plans enable row level security;
drop policy if exists "Authenticated users can read active SaaS plans" on public.saas_plans;
create policy "Authenticated users can read active SaaS plans"
on public.saas_plans for select to authenticated using (is_public);

alter table public.organizations
  add column if not exists subscription_plan text not null default 'free' references public.saas_plans(plan_code),
  add column if not exists subscription_status text not null default 'trial' check (subscription_status in ('trial','active','past_due','cancelled')),
  add column if not exists account_status text not null default 'pending' check (account_status in ('pending','active','suspended')),
  add column if not exists trial_ends_at timestamptz default (now() + interval '14 days'),
  add column if not exists activated_at timestamptz;

-- Existing production accounts remain active; new accounts stay pending until approved.
update public.organizations
set account_status='active', subscription_status='active', activated_at=coalesce(activated_at,now())
where account_status='pending' and created_at < now();

alter table public.sites
  add column if not exists review_status text not null default 'draft'
    check (review_status in ('draft','pending','approved','changes_requested','rejected')),
  add column if not exists review_note text,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists submitted_at timestamptz;

update public.sites
set review_status=case when status='published' then 'approved' else 'draft' end,
    reviewed_at=case when status='published' then coalesce(published_at,updated_at,created_at) else reviewed_at end,
    submitted_at=case when status='published' then coalesce(published_at,created_at) else submitted_at end
where review_status='draft';

create index if not exists sites_review_queue_idx on public.sites(review_status, submitted_at desc);
create index if not exists sites_org_review_idx on public.sites(organization_id, review_status);

create table if not exists public.site_review_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_type text not null default 'site_review_requested'
    check (event_type in ('site_review_requested','site_review_approved','site_review_changes_requested')),
  title text not null,
  message text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists site_review_notifications_recipient_idx on public.site_review_notifications(recipient_id, read_at, created_at desc);
alter table public.site_review_notifications enable row level security;
revoke all on table public.site_review_notifications from anon, authenticated;
grant select, update on table public.site_review_notifications to authenticated;
drop policy if exists "SAMA admins read their site review notifications" on public.site_review_notifications;
create policy "SAMA admins read their site review notifications"
on public.site_review_notifications for select to authenticated
using (recipient_id=(select auth.uid()) and exists (select 1 from public.site_management_admins a where a.user_id=(select auth.uid())));
drop policy if exists "SAMA admins mark their site review notifications read" on public.site_review_notifications;
create policy "SAMA admins mark their site review notifications read"
on public.site_review_notifications for update to authenticated
using (recipient_id=(select auth.uid()) and exists (select 1 from public.site_management_admins a where a.user_id=(select auth.uid())))
with check (recipient_id=(select auth.uid()) and exists (select 1 from public.site_management_admins a where a.user_id=(select auth.uid())));

drop policy if exists "SAMA admins read submitted sites" on public.sites;
create policy "SAMA admins read submitted sites"
on public.sites for select to authenticated
using (submitted_at is not null and exists (select 1 from public.site_management_admins a where a.user_id=(select auth.uid())));
drop policy if exists "SAMA admins read organizations with submitted sites" on public.organizations;
create policy "SAMA admins read organizations with submitted sites"
on public.organizations for select to authenticated
using (
 exists (select 1 from public.site_management_admins a where a.user_id=(select auth.uid()))
 and exists (select 1 from public.sites s where s.organization_id=organizations.id and s.submitted_at is not null)
);
drop policy if exists "SAMA admins read products awaiting site review" on public.products;
create policy "SAMA admins read products awaiting site review"
on public.products for select to authenticated
using (
 exists (select 1 from public.site_management_admins a where a.user_id=(select auth.uid()))
 and exists (select 1 from public.sites s where s.id=products.site_id and s.organization_id=products.organization_id and s.submitted_at is not null)
);

create or replace function public.notify_site_review_queue()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_admin record;
begin
  if NEW.review_status='pending' and NEW.submitted_at is not null
     and (TG_OP='INSERT' or OLD.review_status is distinct from NEW.review_status or OLD.submitted_at is distinct from NEW.submitted_at) then
    for v_admin in select user_id from public.site_management_admins loop
      insert into public.site_review_notifications(recipient_id,site_id,organization_id,event_type,title,message)
      values(v_admin.user_id,NEW.id,NEW.organization_id,'site_review_requested','Nouveau site à valider',
        'Le site « '||left(NEW.name,120)||' » attend une validation avant sa mise en ligne.');
    end loop;
  end if;
  return NEW;
end;
$$;
drop trigger if exists sites_notify_review_queue on public.sites;
create trigger sites_notify_review_queue after insert or update of review_status, submitted_at on public.sites
for each row execute function public.notify_site_review_queue();

create or replace function public.enforce_saas_site_quota()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_max_sites integer; v_max_html integer; v_max_total bigint; v_count bigint; v_total bigint; v_bytes bigint;
begin
  select p.max_sites,p.max_site_html_bytes,p.max_total_site_html_bytes into v_max_sites,v_max_html,v_max_total
  from public.organizations o join public.saas_plans p on p.plan_code=o.subscription_plan where o.id=NEW.organization_id;
  if v_max_sites is null then raise exception 'Abonnement introuvable pour cette entreprise.'; end if;
  v_bytes:=octet_length(coalesce(NEW.html_content,''));
  if v_bytes>v_max_html then raise exception 'Ce site dépasse la limite de stockage de votre abonnement (% Mo par site).',round(v_max_html/1000000.0,1); end if;
  select count(*),coalesce(sum(octet_length(coalesce(html_content,''))),0) into v_count,v_total
  from public.sites where organization_id=NEW.organization_id and (TG_OP='INSERT' or id<>NEW.id);
  if TG_OP='INSERT' and v_count>=v_max_sites then raise exception 'Votre abonnement autorise % site(s). Passez à une formule supérieure pour en créer davantage.',v_max_sites; end if;
  if v_total+v_bytes>v_max_total then raise exception 'Votre espace de sites est presque plein. Limite de votre abonnement : % Mo au total.',round(v_max_total/1000000.0,1); end if;
  return NEW;
end;
$$;
drop trigger if exists sites_enforce_saas_quota on public.sites;
create trigger sites_enforce_saas_quota before insert or update of organization_id, html_content on public.sites
for each row execute function public.enforce_saas_site_quota();

create or replace function public.enforce_saas_product_quota()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_max_products integer; v_count bigint;
begin
  if TG_OP='UPDATE' and NEW.organization_id=OLD.organization_id and NEW.site_id=OLD.site_id then return NEW; end if;
  select p.max_products into v_max_products from public.organizations o join public.saas_plans p on p.plan_code=o.subscription_plan where o.id=NEW.organization_id;
  if v_max_products is null then raise exception 'Abonnement introuvable pour cette entreprise.'; end if;
  select count(*) into v_count from public.products where organization_id=NEW.organization_id and (TG_OP='INSERT' or id<>NEW.id);
  if v_count>=v_max_products then raise exception 'Votre abonnement autorise % produit(s). Archivez des produits ou passez à une formule supérieure.',v_max_products; end if;
  return NEW;
end;
$$;
drop trigger if exists products_enforce_saas_quota on public.products;
create trigger products_enforce_saas_quota before insert or update of organization_id, site_id on public.products
for each row execute function public.enforce_saas_product_quota();

create or replace function public.get_organization_usage(p_organization_id uuid)
returns jsonb language sql stable security invoker set search_path = public, pg_temp
as $$
 select jsonb_build_object(
  'plan_code',p.plan_code,'plan_name',p.display_name,'subscription_status',o.subscription_status,'account_status',o.account_status,
  'site_count',(select count(*) from public.sites s where s.organization_id=o.id),
  'product_count',(select count(*) from public.products pr where pr.organization_id=o.id),
  'site_html_bytes',(select coalesce(sum(octet_length(coalesce(s.html_content,''))),0) from public.sites s where s.organization_id=o.id),
  'max_sites',p.max_sites,'max_products',p.max_products,'max_site_html_bytes',p.max_site_html_bytes,
  'max_total_site_html_bytes',p.max_total_site_html_bytes,'trial_ends_at',o.trial_ends_at
 )
 from public.organizations o join public.saas_plans p on p.plan_code=o.subscription_plan
 where o.id=p_organization_id and public.is_org_member(o.id);
$$;
revoke all on function public.get_organization_usage(uuid) from public, anon;
grant execute on function public.get_organization_usage(uuid) to authenticated;

create or replace function public.review_site_submission(p_site_id uuid,p_decision text,p_note text default null)
returns public.sites language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_user uuid:=auth.uid(); v_site public.sites;
begin
  if v_user is null or not exists(select 1 from public.site_management_admins a where a.user_id=v_user) then raise exception 'Accès réservé à SAMA Studio.'; end if;
  if p_decision not in ('approved','changes_requested','rejected') then raise exception 'Décision de validation invalide.'; end if;
  select * into v_site from public.sites where id=p_site_id for update;
  if not found or v_site.submitted_at is null then raise exception 'Site introuvable ou non soumis à validation.'; end if;
  if p_decision='approved' and not exists(select 1 from public.products pr where pr.site_id=v_site.id and pr.organization_id=v_site.organization_id and pr.is_active and not pr.is_demo) then
    raise exception 'Ajoute au moins un produit réel et actif avant d’approuver ce site.';
  end if;
  update public.sites set review_status=p_decision,review_note=left(coalesce(p_note,''),1200),reviewed_by=v_user,reviewed_at=now(),updated_at=now()
  where id=p_site_id returning * into v_site;
  if p_decision='approved' then
    update public.organizations set account_status='active',subscription_status=case when subscription_status='trial' then 'active' else subscription_status end,activated_at=coalesce(activated_at,now()),updated_at=now()
    where id=v_site.organization_id;
  end if;
  return v_site;
end;
$$;
revoke all on function public.review_site_submission(uuid,text,text) from public, anon;
grant execute on function public.review_site_submission(uuid,text,text) to authenticated;
