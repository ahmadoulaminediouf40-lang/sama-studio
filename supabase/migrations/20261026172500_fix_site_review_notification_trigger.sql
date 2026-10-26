create or replace function public.notify_site_review_queue()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_admin record;
  v_notify boolean:=false;
begin
  if NEW.review_status='pending' and NEW.submitted_at is not null then
    if TG_OP='INSERT' then
      v_notify:=true;
    else
      v_notify:=OLD.review_status is distinct from NEW.review_status
        or OLD.submitted_at is distinct from NEW.submitted_at;
    end if;
  end if;
  if v_notify then
    for v_admin in select user_id from public.site_management_admins loop
      insert into public.site_review_notifications(recipient_id,site_id,organization_id,event_type,title,message)
      values(v_admin.user_id,NEW.id,NEW.organization_id,'site_review_requested','Nouveau site à valider',
        'Le site « '||left(NEW.name,120)||' » attend une validation avant sa mise en ligne.');
    end loop;
  end if;
  return NEW;
end;
$$;
revoke all on function public.notify_site_review_queue() from public,anon,authenticated;
