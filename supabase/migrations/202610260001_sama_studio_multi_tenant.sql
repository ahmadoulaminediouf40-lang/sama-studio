-- Sama Studio multi-tenant production foundation.
-- Apply through Supabase CLI (supabase db push) or the SQL Editor.
begin;
create extension if not exists pgcrypto;

create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 email text, full_name text not null default '',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.organizations (
 id uuid primary key default gen_random_uuid(),
 name text not null check(char_length(trim(name)) between 2 and 120),
 slug text not null unique check(slug ~ '^[a-z0-9][a-z0-9-]{1,50}[a-z0-9]$'),
 owner_id uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.organization_memberships (
 organization_id uuid not null references public.organizations(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null default 'owner' check(role in ('owner','admin','staff','viewer')),
 created_at timestamptz not null default now(), primary key(organization_id,user_id)
);
create index if not exists organization_memberships_user_idx on public.organization_memberships(user_id,organization_id);

create table if not exists public.sites (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 name text not null check(char_length(trim(name)) between 2 and 120),
 slug text not null unique check(slug ~ '^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$'),
 template_id text not null default 'distribution',
 status text not null default 'draft' check(status in ('draft','published','paused')),
 html_content text not null check(char_length(html_content)<=3000000),
 cloudflare_project_name text, cloudflare_deployment_id text, published_url text,
 created_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), published_at timestamptz,
 unique(id,organization_id)
);
create index if not exists sites_org_updated_idx on public.sites(organization_id,updated_at desc);
create index if not exists sites_status_idx on public.sites(status);

create table if not exists public.products (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null, site_id uuid not null, external_ref text, sku text,
 name text not null check(char_length(trim(name)) between 1 and 180),
 category text not null default 'Catalogue', description text not null default '', image_url text,
 price numeric(12,2) not null default 0 check(price>=0), price_label text not null default '',
 currency text not null default 'XOF' check(currency in ('XOF','EUR','USD','GMD','GNF','MAD')),
 stock_quantity integer not null default 0 check(stock_quantity>=0),
 low_stock_threshold integer not null default 5 check(low_stock_threshold>=0),
 is_active boolean not null default true, is_demo boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(site_id,organization_id) references public.sites(id,organization_id) on delete cascade,
 unique(id,organization_id,site_id)
);
create unique index if not exists products_site_sku_unique on public.products(site_id,lower(sku)) where sku is not null and trim(sku)<>'';
create unique index if not exists products_site_external_ref_unique on public.products(site_id,external_ref) where external_ref is not null and external_ref<>'';
create index if not exists products_inventory_idx on public.products(organization_id,site_id,is_active,stock_quantity);
create index if not exists products_search_idx on public.products using gin(to_tsvector('simple',coalesce(name,'')||' '||coalesce(sku,'')||' '||coalesce(category,'')));

create table if not exists public.orders (
 id uuid primary key default gen_random_uuid(),
 order_number bigint generated always as identity unique,
 organization_id uuid not null, site_id uuid not null,
 customer_name text not null check(char_length(trim(customer_name)) between 1 and 140),
 customer_phone text not null check(char_length(trim(customer_phone)) between 5 and 40),
 customer_email text, customer_address text not null default '', notes text not null default '',
 status text not null default 'pending' check(status in ('pending','confirmed','preparing','shipped','completed','cancelled')),
 total numeric(12,2) not null default 0 check(total>=0), currency text not null default 'XOF',
 source text not null default 'storefront', ip_hash text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(site_id,organization_id) references public.sites(id,organization_id) on delete restrict,
 unique(id,organization_id,site_id)
);
create index if not exists orders_org_created_idx on public.orders(organization_id,created_at desc);
create index if not exists orders_site_status_idx on public.orders(site_id,status,created_at desc);
create index if not exists orders_rate_limit_idx on public.orders(site_id,ip_hash,created_at desc);

create table if not exists public.order_items (
 id uuid primary key default gen_random_uuid(), order_id uuid not null,
 organization_id uuid not null, site_id uuid not null, product_id uuid not null,
 product_name text not null, sku text, quantity integer not null check(quantity between 1 and 999),
 unit_price numeric(12,2) not null check(unit_price>=0), price_label text not null default '',
 line_total numeric(12,2) not null check(line_total>=0), created_at timestamptz not null default now(),
 foreign key(order_id,organization_id,site_id) references public.orders(id,organization_id,site_id) on delete cascade,
 foreign key(product_id,organization_id,site_id) references public.products(id,organization_id,site_id) on delete restrict
);
create index if not exists order_items_order_idx on public.order_items(order_id);
create index if not exists order_items_product_idx on public.order_items(product_id,organization_id,site_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path=public as $$
begin new.updated_at:=now(); return new; end; $$;
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists organizations_set_updated_at on public.organizations;
create trigger organizations_set_updated_at before update on public.organizations for each row execute function public.set_updated_at();
drop trigger if exists sites_set_updated_at on public.sites;
create trigger sites_set_updated_at before update on public.sites for each row execute function public.set_updated_at();
drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at before update on public.products for each row execute function public.set_updated_at();
drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at before update on public.orders for each row execute function public.set_updated_at();

create or replace function public.prevent_tenant_reassignment()
returns trigger language plpgsql set search_path=public as $$
begin
 if tg_table_name='sites' and new.organization_id is distinct from old.organization_id then
   raise exception 'A site cannot be reassigned to another organization';
 end if;
 if tg_table_name='products' and (new.organization_id is distinct from old.organization_id or new.site_id is distinct from old.site_id) then
   raise exception 'A product cannot be reassigned to another organization or site';
 end if;
 if tg_table_name='orders' and (new.organization_id is distinct from old.organization_id or new.site_id is distinct from old.site_id) then
   raise exception 'An order cannot be reassigned to another organization or site';
 end if;
 return new;
end; $$;
drop trigger if exists sites_prevent_tenant_reassignment on public.sites;
create trigger sites_prevent_tenant_reassignment before update on public.sites for each row execute function public.prevent_tenant_reassignment();
drop trigger if exists products_prevent_tenant_reassignment on public.products;
create trigger products_prevent_tenant_reassignment before update on public.products for each row execute function public.prevent_tenant_reassignment();
drop trigger if exists orders_prevent_tenant_reassignment on public.orders;
create trigger orders_prevent_tenant_reassignment before update on public.orders for each row execute function public.prevent_tenant_reassignment();

create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into public.profiles(id,email,full_name) values(new.id,new.email,coalesce(new.raw_user_meta_data->>'full_name',''))
 on conflict(id) do update set email=excluded.email;
 return new;
end; $$;
drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile after insert on auth.users for each row execute function public.handle_new_auth_user();

create or replace function public.is_org_member(p_organization_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.organization_memberships m where m.organization_id=p_organization_id and m.user_id=(select auth.uid()));
$$;
create or replace function public.has_org_role(p_organization_id uuid,p_roles text[])
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.organization_memberships m where m.organization_id=p_organization_id and m.user_id=(select auth.uid()) and m.role=any(p_roles));
$$;
create or replace function public.create_organization(p_name text,p_slug text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid(); v_id uuid; v_base text; v_slug text;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 if p_name is null or char_length(trim(p_name))<2 or char_length(trim(p_name))>120 then raise exception 'Organization name must contain 2 to 120 characters'; end if;
 v_base:=lower(trim(both '-' from regexp_replace(coalesce(nullif(trim(p_slug),''),p_name),'[^a-zA-Z0-9]+','-','g')));
 v_base:=trim(both '-' from v_base); if char_length(v_base)<2 then v_base:='studio'; end if;
 v_slug:=left(v_base,40)||'-'||left(replace(gen_random_uuid()::text,'-',''),6);
 insert into public.organizations(name,slug,owner_id) values(trim(p_name),v_slug,v_user) returning id into v_id;
 insert into public.organization_memberships(organization_id,user_id,role) values(v_id,v_user,'owner');
 return v_id;
end; $$;

create or replace function public.handle_order_status_change()
returns trigger language plpgsql set search_path=public as $$
begin
 if old.status in ('cancelled','completed') and new.status<>old.status then raise exception 'Completed or cancelled orders cannot be reopened or changed'; end if;
 if new.status='cancelled' and old.status not in ('pending','confirmed','preparing') then raise exception 'Only orders not yet shipped may be cancelled automatically'; end if;
 if new.status='cancelled' and old.status<>'cancelled' then
   update public.products p set stock_quantity=p.stock_quantity+oi.quantity
   from public.order_items oi where oi.order_id=old.id and p.id=oi.product_id
     and p.organization_id=old.organization_id and p.site_id=old.site_id;
 end if;
 return new;
end; $$;
drop trigger if exists orders_status_restore_stock on public.orders;
create trigger orders_status_restore_stock before update of status on public.orders for each row
when(old.status is distinct from new.status) execute function public.handle_order_status_change();

create or replace function public.update_order_status(p_order_id uuid,p_status text)
returns void language plpgsql security definer set search_path=public as $$
declare v_order public.orders%rowtype; v_allowed text[];
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if p_status not in ('pending','confirmed','preparing','shipped','completed','cancelled') then raise exception 'Invalid order status'; end if;
 select o.* into v_order from public.orders o where o.id=p_order_id;
 if not found then raise exception 'Order not found'; end if;
 if not public.has_org_role(v_order.organization_id,array['owner','admin','staff']) then raise exception 'Not authorized to update this order'; end if;
 v_allowed:=case v_order.status
   when 'pending' then array['pending','confirmed','cancelled']
   when 'confirmed' then array['confirmed','preparing','cancelled']
   when 'preparing' then array['preparing','shipped','cancelled']
   when 'shipped' then array['shipped','completed']
   else array[v_order.status] end;
 if not (p_status=any(v_allowed)) then raise exception 'Invalid order status transition'; end if;
 update public.orders set status=p_status where id=p_order_id;
end; $$;

create or replace function public.create_storefront_order(
 p_site_slug text,p_customer_name text,p_customer_phone text,p_customer_address text,p_notes text,p_items jsonb,p_ip_hash text
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
 v_site public.sites%rowtype; v_product public.products%rowtype; v_item jsonb; v_product_id uuid;
 v_quantity integer; v_order_id uuid; v_order_number bigint; v_total numeric(12,2):=0; v_seen uuid[]:=array[]::uuid[];
begin
 if p_site_slug is null or char_length(p_site_slug)>60 then raise exception 'Invalid site'; end if;
 if p_customer_name is null or char_length(trim(p_customer_name))<1 or char_length(trim(p_customer_name))>140 then raise exception 'Customer name is required'; end if;
 if p_customer_phone is null or char_length(trim(p_customer_phone))<5 or char_length(trim(p_customer_phone))>40 then raise exception 'A valid phone number is required'; end if;
 if char_length(coalesce(p_customer_address,''))>500 or char_length(coalesce(p_notes,''))>1000 then raise exception 'Order details are too long'; end if;
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)<1 or jsonb_array_length(p_items)>30 then raise exception 'Invalid order items'; end if;
 select s.* into v_site from public.sites s where s.slug=p_site_slug and s.status='published';
 if not found then raise exception 'This storefront is not published'; end if;
 if (select count(*) from public.orders o where o.site_id=v_site.id and o.ip_hash=p_ip_hash and o.created_at>now()-interval '10 minutes')>=5 then raise exception 'Too many order attempts. Please try again later.'; end if;
 for v_item in select value from jsonb_array_elements(p_items) loop
   begin v_product_id:=(v_item->>'product_id')::uuid; v_quantity:=(v_item->>'quantity')::integer;
   exception when others then raise exception 'Invalid item in order'; end;
   if v_product_id=any(v_seen) then raise exception 'Duplicate product in order'; end if;
   v_seen:=array_append(v_seen,v_product_id);
   if v_quantity is null or v_quantity<1 or v_quantity>99 then raise exception 'Invalid product quantity'; end if;
   select p.* into v_product from public.products p where p.id=v_product_id and p.organization_id=v_site.organization_id and p.site_id=v_site.id and p.is_active and not p.is_demo for update;
   if not found then raise exception 'Product is unavailable'; end if;
   if v_product.stock_quantity<v_quantity then raise exception 'Insufficient stock for %',v_product.name; end if;
   v_total:=v_total+(v_product.price*v_quantity);
 end loop;
 insert into public.orders(organization_id,site_id,customer_name,customer_phone,customer_address,notes,status,total,currency,source,ip_hash)
 values(v_site.organization_id,v_site.id,trim(p_customer_name),trim(p_customer_phone),coalesce(trim(p_customer_address),''),coalesce(trim(p_notes),''),'pending',v_total,'XOF','storefront',p_ip_hash)
 returning id,order_number into v_order_id,v_order_number;
 for v_item in select value from jsonb_array_elements(p_items) loop
   v_product_id:=(v_item->>'product_id')::uuid; v_quantity:=(v_item->>'quantity')::integer;
   select p.* into v_product from public.products p where p.id=v_product_id and p.organization_id=v_site.organization_id and p.site_id=v_site.id for update;
   insert into public.order_items(order_id,organization_id,site_id,product_id,product_name,sku,quantity,unit_price,price_label,line_total)
   values(v_order_id,v_site.organization_id,v_site.id,v_product.id,v_product.name,v_product.sku,v_quantity,v_product.price,coalesce(nullif(v_product.price_label,''),v_product.price::text),v_product.price*v_quantity);
   update public.products set stock_quantity=stock_quantity-v_quantity where id=v_product.id;
 end loop;
 return jsonb_build_object('order_id',v_order_id,'order_number',v_order_number,'total',v_total,'currency','XOF');
end; $$;

revoke all on public.profiles,public.organizations,public.organization_memberships,public.sites,public.products,public.orders,public.order_items from anon,authenticated;
grant select,update on public.profiles to authenticated;
grant select on public.organizations to authenticated;
grant select on public.organization_memberships to authenticated;
grant select,insert,update,delete on public.sites to authenticated;
grant select,insert,update,delete on public.products to authenticated;
grant select on public.orders,public.order_items to authenticated;

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.sites enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

drop policy if exists profile_select_self on public.profiles;
create policy profile_select_self on public.profiles for select to authenticated using(id=(select auth.uid()));
drop policy if exists profile_update_self on public.profiles;
create policy profile_update_self on public.profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));

drop policy if exists organizations_select_member on public.organizations;
create policy organizations_select_member on public.organizations for select to authenticated using(public.is_org_member(id));
drop policy if exists memberships_select_same_org on public.organization_memberships;
create policy memberships_select_same_org on public.organization_memberships for select to authenticated using(public.is_org_member(organization_id));

drop policy if exists sites_select_member on public.sites;
create policy sites_select_member on public.sites for select to authenticated using(public.is_org_member(organization_id));
drop policy if exists sites_insert_admin on public.sites;
create policy sites_insert_admin on public.sites for insert to authenticated with check(public.has_org_role(organization_id,array['owner','admin','staff']) and created_by=(select auth.uid()));
drop policy if exists sites_update_admin on public.sites;
create policy sites_update_admin on public.sites for update to authenticated using(public.has_org_role(organization_id,array['owner','admin','staff'])) with check(public.has_org_role(organization_id,array['owner','admin','staff']));
drop policy if exists sites_delete_admin on public.sites;
create policy sites_delete_admin on public.sites for delete to authenticated using(public.has_org_role(organization_id,array['owner','admin']));

drop policy if exists products_select_member on public.products;
create policy products_select_member on public.products for select to authenticated using(public.is_org_member(organization_id));
drop policy if exists products_insert_admin on public.products;
create policy products_insert_admin on public.products for insert to authenticated with check(public.has_org_role(organization_id,array['owner','admin','staff']));
drop policy if exists products_update_admin on public.products;
create policy products_update_admin on public.products for update to authenticated using(public.has_org_role(organization_id,array['owner','admin','staff'])) with check(public.has_org_role(organization_id,array['owner','admin','staff']));
drop policy if exists products_delete_admin on public.products;
create policy products_delete_admin on public.products for delete to authenticated using(public.has_org_role(organization_id,array['owner','admin']));

drop policy if exists orders_select_member on public.orders;
create policy orders_select_member on public.orders for select to authenticated using(public.is_org_member(organization_id));
drop policy if exists order_items_select_member on public.order_items;
create policy order_items_select_member on public.order_items for select to authenticated using(public.is_org_member(organization_id));

revoke all on function public.is_org_member(uuid) from public,anon;
revoke all on function public.has_org_role(uuid,text[]) from public,anon;
revoke all on function public.create_organization(text,text) from public,anon;
revoke all on function public.update_order_status(uuid,text) from public,anon;
revoke all on function public.create_storefront_order(text,text,text,text,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.has_org_role(uuid,text[]) to authenticated;
grant execute on function public.create_organization(text,text) to authenticated;
grant execute on function public.update_order_status(uuid,text) to authenticated;
grant execute on function public.create_storefront_order(text,text,text,text,text,jsonb,text) to service_role;
commit();
