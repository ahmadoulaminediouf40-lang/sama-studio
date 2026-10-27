begin;

create index if not exists product_price_history_checked_by_idx
  on public.product_price_history(checked_by);
create index if not exists product_price_history_product_org_site_checked_idx
  on public.product_price_history(product_id,organization_id,site_id,checked_at desc);

create or replace function public.update_order_status(p_order_id uuid,p_status text)
returns void language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_order public.orders%rowtype;v_allowed text[];
begin
 if auth.uid() is null then raise exception 'Authentification requise'; end if;
 if p_status not in ('pending','confirmed','preparing','shipped','completed','cancelled') then raise exception 'Statut de commande invalide'; end if;
 select o.* into v_order from public.orders o where o.id=p_order_id;
 if not found then raise exception 'Commande introuvable'; end if;
 if not exists(
   select 1 from public.organizations org
   join public.site_management_admins platform_owner on platform_owner.user_id=org.owner_id
   where org.id=v_order.organization_id
 ) then raise exception 'Cette commande n’appartient pas au réseau de boutiques SAMA.'; end if;
 if not public.has_org_role(v_order.organization_id,array['owner','admin','staff']) then
   raise exception 'Tu n’as pas le droit de modifier cette commande';
 end if;
 v_allowed:=case v_order.status
   when 'pending' then array['pending','confirmed','cancelled']
   when 'confirmed' then array['confirmed','preparing','cancelled']
   when 'preparing' then array['preparing','shipped','cancelled']
   when 'shipped' then array['shipped','completed']
   else array[v_order.status] end;
 if not (p_status=any(v_allowed)) then raise exception 'Transition de commande invalide'; end if;
 update public.orders set status=p_status where id=p_order_id;
end; $function$;

-- Retire définitivement du rôle authenticated les anciens RPC du flux client-sites.
revoke all on function public.create_organization(text,text) from public,anon,authenticated;
revoke all on function public.review_site_submission(uuid,text,text) from public,anon,authenticated;
revoke all on function public.respond_site_management_request(uuid,text) from public,anon,authenticated;
revoke all on function public.revoke_site_management_request(uuid) from public,anon,authenticated;

comment on function public.list_published_storefronts() is
  'Public SAMA shop directory: returns only published first-party storefront name, slug, template and public URL; never exposes catalog or customer data.';
commit;