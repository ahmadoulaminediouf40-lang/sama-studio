-- Requeue submitted sites after product content changes.
create or replace function public.requeue_site_after_product_content_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.sites
  set review_status='pending',
      submitted_at=now(),
      review_note=null,
      reviewed_by=null,
      reviewed_at=null,
      updated_at=now()
  where id=NEW.site_id
    and organization_id=NEW.organization_id
    and submitted_at is not null
    and review_status in ('approved','changes_requested','rejected');
  return NEW;
end;
$$;

drop trigger if exists products_requeue_site_review on public.products;
create trigger products_requeue_site_review
after insert or update of name,category,description,image_url,price,price_label,currency,is_active,is_demo
on public.products
for each row execute function public.requeue_site_after_product_content_change();

revoke all on function public.requeue_site_after_product_content_change() from public, anon, authenticated;
revoke all on function public.notify_site_review_queue() from public, anon, authenticated;

create or replace function public.review_site_submission(p_site_id uuid,p_decision text,p_note text default null)
returns public.sites
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v_user uuid:=auth.uid();v_site public.sites;
begin
 if v_user is null or not exists(select 1 from public.site_management_admins a where a.user_id=v_user) then
  raise exception 'Accès réservé à SAMA Studio.';
 end if;
 if p_decision not in ('approved','changes_requested','rejected') then
  raise exception 'Décision de validation invalide.';
 end if;
 select * into v_site from public.sites where id=p_site_id for update;
 if not found or v_site.submitted_at is null then
  raise exception 'Site introuvable ou non soumis à validation.';
 end if;
 if p_decision='approved' and not exists(
  select 1 from public.products pr
  where pr.site_id=v_site.id and pr.organization_id=v_site.organization_id and pr.is_active and not pr.is_demo and pr.stock_quantity>0
 ) then
  raise exception 'Ajoute au moins un produit réel et actif avant d’approuver ce site.';
 end if;
 update public.sites
 set review_status=p_decision,review_note=left(coalesce(p_note,''),1200),
     reviewed_by=v_user,reviewed_at=now(),updated_at=now()
 where id=p_site_id returning * into v_site;
 if p_decision='approved' then
  update public.organizations
  set account_status='active',activated_at=coalesce(activated_at,now()),updated_at=now()
  where id=v_site.organization_id;
 end if;
 return v_site;
end;
$$;
revoke all on function public.review_site_submission(uuid,text,text) from public, anon;
grant execute on function public.review_site_submission(uuid,text,text) to authenticated;
