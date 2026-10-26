create or replace function public.guard_site_review_and_deployment_fields()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_uid uuid:=auth.uid();
  v_role text:=coalesce(auth.role(),current_setting('request.jwt.claim.role',true),'');
  v_is_platform_admin boolean:=false;
begin
  if v_role='service_role' then return NEW; end if;
  if v_uid is not null then
    select exists(select 1 from public.site_management_admins a where a.user_id=v_uid)
      into v_is_platform_admin;
  end if;

  if TG_OP='INSERT' then
    if not v_is_platform_admin then
      if NEW.review_status not in ('draft','pending')
        or NEW.reviewed_by is not null
        or NEW.reviewed_at is not null
        or NEW.status<>'draft'
        or NEW.cloudflare_project_name is not null
        or NEW.cloudflare_deployment_id is not null
        or NEW.published_url is not null
        or NEW.published_at is not null then
        raise exception 'Un nouveau site doit rester en brouillon ou en attente de validation. Seul SAMA Studio peut approuver ou publier.';
      end if;
      if NEW.review_status='pending' and NEW.submitted_at is null then
        raise exception 'Une demande de validation doit avoir une date d’envoi.';
      end if;
    end if;
    return NEW;
  end if;

  if not v_is_platform_admin then
    if NEW.review_status not in ('draft','pending') then
      raise exception 'Seul SAMA Studio peut approuver ou refuser un site.';
    end if;
    if NEW.reviewed_by is distinct from OLD.reviewed_by and NEW.reviewed_by is not null then
      raise exception 'Le réviseur ne peut être défini que par SAMA Studio.';
    end if;
    if NEW.reviewed_at is distinct from OLD.reviewed_at and NEW.reviewed_at is not null then
      raise exception 'La date de validation ne peut être définie que par SAMA Studio.';
    end if;
    if NEW.status is distinct from OLD.status
      or NEW.cloudflare_project_name is distinct from OLD.cloudflare_project_name
      or NEW.cloudflare_deployment_id is distinct from OLD.cloudflare_deployment_id
      or NEW.published_url is distinct from OLD.published_url
      or NEW.published_at is distinct from OLD.published_at then
      raise exception 'Les informations de publication sont gérées par SAMA Studio.';
    end if;
    if NEW.review_status='pending' and NEW.submitted_at is null then
      raise exception 'Une demande de validation doit avoir une date d’envoi.';
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists sites_guard_review_and_deployment_fields on public.sites;
create trigger sites_guard_review_and_deployment_fields
before insert or update of review_status,reviewed_by,reviewed_at,status,cloudflare_project_name,cloudflare_deployment_id,published_url,published_at,submitted_at
on public.sites
for each row execute function public.guard_site_review_and_deployment_fields();

revoke all on function public.guard_site_review_and_deployment_fields() from public,anon,authenticated;
