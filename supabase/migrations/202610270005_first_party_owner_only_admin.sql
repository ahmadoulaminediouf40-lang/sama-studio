begin;

create or replace function public.create_organization(p_name text,p_slug text default null)
returns uuid language plpgsql security definer set search_path=public as $function$
declare v_user uuid:=auth.uid(); v_id uuid; v_base text; v_slug text;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 if not exists(select 1 from public.site_management_admins a where a.user_id=v_user) then
   raise exception 'La création d’espaces clients est désactivée : l’administration est réservée au propriétaire SAMA.';
 end if;
 if p_name is null or char_length(trim(p_name))<2 or char_length(trim(p_name))>120 then raise exception 'Organization name must contain 2 to 120 characters'; end if;
 v_base:=lower(trim(both '-' from regexp_replace(coalesce(nullif(trim(p_slug),''),p_name),'[^a-zA-Z0-9]+','-','g')));
 v_base:=trim(both '-' from v_base); if char_length(v_base)<2 then v_base:='sama'; end if;
 v_slug:=left(v_base,40)||'-'||left(replace(gen_random_uuid()::text,'-',''),6);
 insert into public.organizations(name,slug,owner_id) values(trim(p_name),v_slug,v_user) returning id into v_id;
 insert into public.organization_memberships(organization_id,user_id,role) values(v_id,v_user,'owner');
 return v_id;
end; $function$;

create or replace function public.list_published_storefronts()
returns table(store_name text,store_slug text,template_id text,storefront_url text,published_at timestamptz)
language sql stable security definer set search_path=public,pg_temp as $function$
 select s.name,s.slug,s.template_id,s.published_url,s.published_at
 from public.sites s
 join public.organizations o on o.id=s.organization_id
 join public.site_management_admins owner_admin on owner_admin.user_id=o.owner_id
 where s.status='published' and s.published_url is not null and s.published_url ~* '^https?://'
 order by s.published_at desc nulls last,s.name asc
 limit 100;
$function$;
revoke all on function public.list_published_storefronts() from public;
grant execute on function public.list_published_storefronts() to anon,authenticated;

create or replace function public.update_storefront_order_fulfillment(
 p_order_id uuid,p_payment_status text,p_payment_method text,p_procurement_status text,p_supplier_order_reference text,
 p_delivery_provider text,p_tracking_code text,p_estimated_delivery_at timestamptz,p_delivery_fee_xof numeric,
 p_estimated_delivery_cost_xof numeric,p_actual_purchase_cost_xof numeric,p_actual_delivery_cost_xof numeric
) returns void language plpgsql security definer set search_path=public as $function$
declare v_order public.orders%rowtype;
begin
 if auth.uid() is null then raise exception 'Authentification requise'; end if;
 select o.* into v_order from public.orders o where o.id=p_order_id;
 if not found then raise exception 'Commande introuvable'; end if;
 if not exists(
   select 1 from public.organizations org
   join public.site_management_admins admin_owner on admin_owner.user_id=org.owner_id
   where org.id=v_order.organization_id
 ) then raise exception 'Cette commande n’appartient pas au réseau de boutiques SAMA.'; end if;
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
end; $function$;
revoke all on function public.update_storefront_order_fulfillment(uuid,text,text,text,text,text,text,timestamptz,numeric,numeric,numeric,numeric) from public,anon;
grant execute on function public.update_storefront_order_fulfillment(uuid,text,text,text,text,text,text,timestamptz,numeric,numeric,numeric,numeric) to authenticated;

commit;