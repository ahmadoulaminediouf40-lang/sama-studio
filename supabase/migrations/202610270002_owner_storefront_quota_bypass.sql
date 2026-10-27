begin;
create or replace function public.enforce_saas_site_quota()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_max_sites integer;v_max_html integer;v_max_total bigint;v_count bigint;v_total bigint;v_bytes bigint;
begin
  if auth.uid() is not null and exists(select 1 from public.site_management_admins a where a.user_id=auth.uid()) then
    return NEW;
  end if;
  select p.max_sites,p.max_site_html_bytes,p.max_total_site_html_bytes into v_max_sites,v_max_html,v_max_total
  from public.organizations o join public.saas_plans p on p.plan_code=o.subscription_plan where o.id=NEW.organization_id;
  if v_max_sites is null then raise exception 'Abonnement introuvable pour cette entreprise.'; end if;
  v_bytes:=octet_length(coalesce(NEW.html_content,''));
  if v_bytes>v_max_html then raise exception 'Ce site dépasse la limite de stockage de votre abonnement (% Mo par site).',round(v_max_html/1000000.0,1); end if;
  select count(*),coalesce(sum(octet_length(coalesce(s.html_content,''))),0) into v_count,v_total
  from public.sites s where s.organization_id=NEW.organization_id and (TG_OP='INSERT' or s.id<>NEW.id);
  if TG_OP='INSERT' and v_count>=v_max_sites then raise exception 'Votre abonnement autorise % site(s). Passez à une formule supérieure pour en créer davantage.',v_max_sites; end if;
  if v_total+v_bytes>v_max_total then raise exception 'Votre espace de sites est presque plein. Limite de votre abonnement : % Mo au total.',round(v_max_total/1000000.0,1); end if;
  return NEW;
end; $function$;
create or replace function public.enforce_saas_product_quota()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_max_products integer;v_count bigint;
begin
  if auth.uid() is not null and exists(select 1 from public.site_management_admins a where a.user_id=auth.uid()) then
    return NEW;
  end if;
  if TG_OP='UPDATE' and NEW.organization_id=OLD.organization_id and NEW.site_id=OLD.site_id then return NEW; end if;
  select p.max_products into v_max_products from public.organizations o join public.saas_plans p on p.plan_code=o.subscription_plan where o.id=NEW.organization_id;
  if v_max_products is null then raise exception 'Abonnement introuvable pour cette entreprise.'; end if;
  select count(*) into v_count from public.products where organization_id=NEW.organization_id and (TG_OP='INSERT' or id<>NEW.id);
  if v_count>=v_max_products then raise exception 'Votre abonnement autorise % produit(s). Archivez des produits ou passez à une formule supérieure.',v_max_products; end if;
  return NEW;
end; $function$;
commit;