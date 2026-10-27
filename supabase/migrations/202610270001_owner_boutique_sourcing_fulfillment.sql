begin;
alter table public.products
  add column if not exists source_store_name text,
  add column if not exists source_url text check (source_url is null or source_url ~* '^https?://'),
  add column if not exists source_price numeric(12,2) check (source_price is null or source_price >= 0),
  add column if not exists source_currency text not null default 'XOF' check (source_currency in ('XOF','EUR','USD','GMD','GNF','MAD')),
  add column if not exists source_exchange_rate numeric(12,4) not null default 1 check (source_exchange_rate > 0),
  add column if not exists source_shipping_xof numeric(12,2) not null default 0 check (source_shipping_xof >= 0),
  add column if not exists other_costs_xof numeric(12,2) not null default 0 check (other_costs_xof >= 0),
  add column if not exists margin_percent numeric(6,2) not null default 30 check (margin_percent between 0 and 500),
  add column if not exists source_checked_at timestamptz,
  add column if not exists fulfillment_mode text not null default 'on_demand' check (fulfillment_mode in ('on_demand','stocked','supplier_direct'));
create index if not exists products_source_checked_idx on public.products(source_checked_at);
create index if not exists products_fulfillment_idx on public.products(site_id,fulfillment_mode,is_active);

alter table public.orders
  add column if not exists payment_status text not null default 'pending' check (payment_status in ('pending','awaiting_payment','paid','cash_on_delivery','refunded')),
  add column if not exists procurement_status text not null default 'not_ordered' check (procurement_status in ('not_ordered','ordered','received','unavailable','returned')),
  add column if not exists supplier_order_reference text,
  add column if not exists delivery_provider text,
  add column if not exists tracking_code text,
  add column if not exists estimated_delivery_at timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists delivery_fee_xof numeric(12,2) not null default 0 check (delivery_fee_xof >= 0),
  add column if not exists estimated_delivery_cost_xof numeric(12,2) not null default 0 check (estimated_delivery_cost_xof >= 0),
  add column if not exists estimated_purchase_cost_xof numeric(12,2) not null default 0 check (estimated_purchase_cost_xof >= 0),
  add column if not exists actual_purchase_cost_xof numeric(12,2) check (actual_purchase_cost_xof is null or actual_purchase_cost_xof >= 0),
  add column if not exists actual_delivery_cost_xof numeric(12,2) check (actual_delivery_cost_xof is null or actual_delivery_cost_xof >= 0),
  add column if not exists payment_method text;
create index if not exists orders_fulfillment_idx on public.orders(organization_id,procurement_status,payment_status,created_at desc);

alter table public.order_items
  add column if not exists source_store_name text,
  add column if not exists source_url text check (source_url is null or source_url ~* '^https?://'),
  add column if not exists source_unit_price numeric(12,2) check (source_unit_price is null or source_unit_price >= 0),
  add column if not exists source_currency text,
  add column if not exists source_exchange_rate numeric(12,4),
  add column if not exists unit_cost_xof numeric(12,2),
  add column if not exists line_cost_xof numeric(12,2),
  add column if not exists estimated_margin_xof numeric(12,2),
  add column if not exists source_checked_at timestamptz;

create table if not exists public.product_price_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  site_id uuid not null,
  product_id uuid not null,
  source_store_name text,
  source_url text,
  source_price numeric(12,2) not null check (source_price >= 0),
  source_currency text not null check (source_currency in ('XOF','EUR','USD','GMD','GNF','MAD')),
  source_exchange_rate numeric(12,4) not null check (source_exchange_rate > 0),
  source_shipping_xof numeric(12,2) not null default 0 check (source_shipping_xof >= 0),
  other_costs_xof numeric(12,2) not null default 0 check (other_costs_xof >= 0),
  margin_percent numeric(6,2) not null check (margin_percent between 0 and 500),
  selling_price_xof numeric(12,2) not null check (selling_price_xof >= 0),
  checked_at timestamptz not null default now(),
  checked_by uuid references auth.users(id) on delete set null,
  foreign key(product_id,organization_id,site_id)
    references public.products(id,organization_id,site_id) on delete cascade
);
create index if not exists product_price_history_product_idx on public.product_price_history(product_id,checked_at desc);
alter table public.product_price_history enable row level security;
revoke all on public.product_price_history from anon,authenticated;
grant select on public.product_price_history to authenticated;
drop policy if exists product_price_history_select_member on public.product_price_history;
create policy product_price_history_select_member on public.product_price_history
  for select to authenticated using (public.is_org_member(organization_id));

create or replace function public.snapshot_product_price_check()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.source_checked_at is not null and
     (tg_op = 'INSERT' or old.source_checked_at is distinct from new.source_checked_at) and
     new.source_price is not null and new.source_url is not null then
    insert into public.product_price_history(
      organization_id,site_id,product_id,source_store_name,source_url,source_price,source_currency,
      source_exchange_rate,source_shipping_xof,other_costs_xof,margin_percent,selling_price_xof,checked_at,checked_by
    ) values (
      new.organization_id,new.site_id,new.id,new.source_store_name,new.source_url,new.source_price,new.source_currency,
      new.source_exchange_rate,new.source_shipping_xof,new.other_costs_xof,new.margin_percent,new.price,
      new.source_checked_at,auth.uid()
    );
  end if;
  return new;
end; $$;
revoke all on function public.snapshot_product_price_check() from public,anon,authenticated;
drop trigger if exists products_snapshot_price_check on public.products;
create trigger products_snapshot_price_check
after insert or update of source_checked_at on public.products
for each row execute function public.snapshot_product_price_check();

create or replace function public.handle_order_status_change()
returns trigger language plpgsql set search_path=public as $$
begin
  if old.status in ('cancelled','completed') and new.status<>old.status then
    raise exception 'Completed or cancelled orders cannot be reopened or changed';
  end if;
  if new.status='cancelled' and old.status not in ('pending','confirmed','preparing') then
    raise exception 'Only orders not yet shipped may be cancelled automatically';
  end if;
  if new.status='cancelled' and old.status<>'cancelled' then
    update public.products p set stock_quantity=p.stock_quantity+oi.quantity
      from public.order_items oi
      where oi.order_id=old.id and p.id=oi.product_id
        and p.organization_id=old.organization_id and p.site_id=old.site_id
        and p.fulfillment_mode='stocked';
  end if;
  if new.status='completed' and old.status is distinct from 'completed' then
    new.delivered_at:=coalesce(new.delivered_at,now());
  end if;
  return new;
end; $$;

create or replace function public.create_storefront_order(
  p_site_slug text,p_customer_name text,p_customer_phone text,p_customer_address text,p_notes text,p_items jsonb,p_ip_hash text
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_site public.sites%rowtype; v_product public.products%rowtype; v_item jsonb; v_product_id uuid;
  v_quantity integer; v_expected_price numeric(12,2); v_unit_cost numeric(12,2);
  v_order_id uuid; v_order_number bigint; v_total numeric(12,2):=0;
  v_estimated_cost numeric(12,2):=0; v_seen uuid[]:=array[]::uuid[];
begin
  if p_site_slug is null or char_length(p_site_slug)>60 then raise exception 'Identifiant de boutique invalide'; end if;
  if p_customer_name is null or char_length(trim(p_customer_name))<1 or char_length(trim(p_customer_name))>140 then raise exception 'Le nom du client est obligatoire'; end if;
  if p_customer_phone is null or char_length(trim(p_customer_phone))<5 or char_length(trim(p_customer_phone))>40 then raise exception 'Un numéro de téléphone valide est obligatoire'; end if;
  if char_length(coalesce(p_customer_address,''))>500 or char_length(coalesce(p_notes,''))>1000 then raise exception 'Les informations de livraison sont trop longues'; end if;
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)<1 or jsonb_array_length(p_items)>30 then raise exception 'Le panier est vide ou invalide'; end if;

  select s.* into v_site from public.sites s where s.slug=p_site_slug and s.status='published';
  if not found then raise exception 'Cette boutique n’est pas publiée'; end if;
  if (select count(*) from public.orders o where o.site_id=v_site.id and o.ip_hash=p_ip_hash and o.created_at>now()-interval '10 minutes')>=5 then raise exception 'Too many order attempts. Réessaie dans quelques minutes.'; end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    begin
      v_product_id:=(v_item->>'product_id')::uuid;
      v_quantity:=(v_item->>'quantity')::integer;
      v_expected_price:=nullif(v_item->>'expected_unit_price','')::numeric;
    exception when others then raise exception 'Un article ou un prix est invalide'; end;
    if v_product_id=any(v_seen) then raise exception 'Un même produit apparaît plusieurs fois dans le panier'; end if;
    v_seen:=array_append(v_seen,v_product_id);
    if v_quantity is null or v_quantity<1 or v_quantity>99 then raise exception 'Quantité invalide'; end if;
    select p.* into v_product from public.products p
      where p.id=v_product_id and p.organization_id=v_site.organization_id and p.site_id=v_site.id
        and p.is_active and not p.is_demo for update;
    if not found then raise exception 'Un produit n’est plus disponible'; end if;
    if v_expected_price is not null and abs(v_expected_price-v_product.price)>0.01 then
      raise exception 'Le prix de % vient de changer. Actualise la boutique avant de commander.',v_product.name;
    end if;
    if v_product.source_url is null or v_product.source_price is null or v_product.source_price<=0
       or v_product.source_checked_at is null or v_product.source_checked_at<now()-interval '7 days' then
      raise exception 'La référence de prix de % doit être vérifiée avant cette commande.',v_product.name;
    end if;
    if v_product.fulfillment_mode='stocked' and v_product.stock_quantity<v_quantity then
      raise exception 'Stock insuffisant pour %',v_product.name;
    end if;
    v_unit_cost:=round(v_product.source_price*v_product.source_exchange_rate+v_product.source_shipping_xof+v_product.other_costs_xof,2);
    v_total:=v_total+(v_product.price*v_quantity);
    v_estimated_cost:=v_estimated_cost+(v_unit_cost*v_quantity);
  end loop;

  insert into public.orders(
    organization_id,site_id,customer_name,customer_phone,customer_address,notes,status,total,currency,source,ip_hash,
    payment_status,procurement_status,estimated_purchase_cost_xof
  ) values (
    v_site.organization_id,v_site.id,trim(p_customer_name),trim(p_customer_phone),coalesce(trim(p_customer_address),''),
    coalesce(trim(p_notes),''),'pending',v_total,'XOF','storefront',p_ip_hash,'pending','not_ordered',v_estimated_cost
  ) returning id,order_number into v_order_id,v_order_number;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_product_id:=(v_item->>'product_id')::uuid;
    v_quantity:=(v_item->>'quantity')::integer;
    select p.* into v_product from public.products p where p.id=v_product_id
      and p.organization_id=v_site.organization_id and p.site_id=v_site.id for update;
    v_unit_cost:=round(v_product.source_price*v_product.source_exchange_rate+v_product.source_shipping_xof+v_product.other_costs_xof,2);
    insert into public.order_items(
      order_id,organization_id,site_id,product_id,product_name,sku,quantity,unit_price,price_label,line_total,
      source_store_name,source_url,source_unit_price,source_currency,source_exchange_rate,unit_cost_xof,line_cost_xof,
      estimated_margin_xof,source_checked_at
    ) values (
      v_order_id,v_site.organization_id,v_site.id,v_product.id,v_product.name,v_product.sku,v_quantity,v_product.price,
      coalesce(nullif(v_product.price_label,''),v_product.price::text),v_product.price*v_quantity,
      v_product.source_store_name,v_product.source_url,v_product.source_price,v_product.source_currency,
      v_product.source_exchange_rate,v_unit_cost,v_unit_cost*v_quantity,(v_product.price-v_unit_cost)*v_quantity,v_product.source_checked_at
    );
    if v_product.fulfillment_mode='stocked' then
      update public.products set stock_quantity=stock_quantity-v_quantity where id=v_product.id;
    end if;
  end loop;
  return jsonb_build_object('order_id',v_order_id,'order_number',v_order_number,'total',v_total,'estimated_purchase_cost_xof',v_estimated_cost,'currency','XOF');
end; $$;

create or replace function public.update_storefront_order_fulfillment(
  p_order_id uuid,p_payment_status text,p_payment_method text,p_procurement_status text,p_supplier_order_reference text,
  p_delivery_provider text,p_tracking_code text,p_estimated_delivery_at timestamptz,p_delivery_fee_xof numeric,
  p_estimated_delivery_cost_xof numeric,p_actual_purchase_cost_xof numeric,p_actual_delivery_cost_xof numeric
) returns void language plpgsql security definer set search_path=public as $$
declare v_order public.orders%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentification requise'; end if;
  select o.* into v_order from public.orders o where o.id=p_order_id;
  if not found then raise exception 'Commande introuvable'; end if;
  if not public.has_org_role(v_order.organization_id,array['owner','admin','staff']) then
    raise exception 'Tu n’as pas le droit de gérer cette commande';
  end if;
  if p_payment_status not in ('pending','awaiting_payment','paid','cash_on_delivery','refunded') then raise exception 'Statut de paiement invalide'; end if;
  if p_procurement_status not in ('not_ordered','ordered','received','unavailable','returned') then raise exception 'Statut d’approvisionnement invalide'; end if;
  if coalesce(p_delivery_fee_xof,0)<0 or coalesce(p_estimated_delivery_cost_xof,0)<0
     or (p_actual_purchase_cost_xof is not null and p_actual_purchase_cost_xof<0)
     or (p_actual_delivery_cost_xof is not null and p_actual_delivery_cost_xof<0) then
    raise exception 'Les coûts doivent être positifs ou nuls';
  end if;
  update public.orders set
    payment_status=p_payment_status,
    payment_method=nullif(left(trim(coalesce(p_payment_method,'')),80),''),
    procurement_status=p_procurement_status,
    supplier_order_reference=nullif(left(trim(coalesce(p_supplier_order_reference,'')),160),''),
    delivery_provider=nullif(left(trim(coalesce(p_delivery_provider,'')),120),''),
    tracking_code=nullif(left(trim(coalesce(p_tracking_code,'')),160),''),
    estimated_delivery_at=p_estimated_delivery_at,
    delivery_fee_xof=coalesce(p_delivery_fee_xof,0),
    estimated_delivery_cost_xof=coalesce(p_estimated_delivery_cost_xof,0),
    actual_purchase_cost_xof=p_actual_purchase_cost_xof,
    actual_delivery_cost_xof=p_actual_delivery_cost_xof
  where id=p_order_id;
end; $$;

revoke all on function public.update_storefront_order_fulfillment(uuid,text,text,text,text,text,text,timestamptz,numeric,numeric,numeric,numeric) from public,anon;
grant execute on function public.update_storefront_order_fulfillment(uuid,text,text,text,text,text,text,timestamptz,numeric,numeric,numeric,numeric) to authenticated;
revoke all on function public.create_storefront_order(text,text,text,text,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.create_storefront_order(text,text,text,text,text,jsonb,text) to service_role;
commit;
