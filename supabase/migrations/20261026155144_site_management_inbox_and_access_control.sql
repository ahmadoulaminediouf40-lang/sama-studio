create table if not exists public.site_management_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.site_management_admins enable row level security;
revoke all on table public.site_management_admins from anon, authenticated;
grant select on table public.site_management_admins to authenticated;
drop policy if exists "Platform managers can see their own registration" on public.site_management_admins;
create policy "Platform managers can see their own registration"
on public.site_management_admins
for select to authenticated
using (user_id = (select auth.uid()));

alter table public.site_management_requests
  add column if not exists handled_by uuid references auth.users(id) on delete set null;
alter table public.site_management_requests
  add column if not exists previous_membership_role text;

drop policy if exists "Owners can read site management requests" on public.site_management_requests;
create policy "Owners and platform managers can read site management requests"
on public.site_management_requests
for select to authenticated
using (
  exists (
    select 1 from public.organization_memberships m
    where m.organization_id = site_management_requests.organization_id
      and m.user_id = (select auth.uid())
      and m.role in ('owner','admin')
  )
  or exists (
    select 1 from public.site_management_admins a
    where a.user_id = (select auth.uid())
  )
);

create unique index if not exists site_management_one_active_request_per_org
  on public.site_management_requests(organization_id)
  where status in ('accepted','in_progress');

create or replace function public.respond_site_management_request(p_request_id uuid, p_status text)
returns public.site_management_requests
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_request public.site_management_requests;
  v_previous_role text;
begin
  if v_user is null or not exists (
    select 1 from public.site_management_admins a where a.user_id = v_user
  ) then
    raise exception 'Accès réservé aux gestionnaires SAMA Studio.';
  end if;
  if p_status not in ('accepted','declined','in_progress','completed') then
    raise exception 'Statut de réponse invalide.';
  end if;
  select * into v_request
  from public.site_management_requests
  where id = p_request_id
  for update;
  if not found then raise exception 'Demande introuvable.'; end if;

  if p_status in ('accepted','declined') then
    if v_request.status <> 'pending' then
      raise exception 'Cette demande a déjà été traitée.';
    end if;
    if p_status = 'declined' then
      update public.site_management_requests
        set status = 'declined', handled_by = v_user, handled_at = now(), updated_at = now()
        where id = p_request_id returning * into v_request;
      return v_request;
    end if;
    if exists (
      select 1 from public.site_management_requests r
      where r.organization_id = v_request.organization_id
        and r.id <> p_request_id
        and r.status in ('accepted','in_progress')
    ) then
      raise exception 'Une prise en charge est déjà active pour cette entreprise.';
    end if;
    select m.role into v_previous_role
      from public.organization_memberships m
      where m.organization_id = v_request.organization_id and m.user_id = v_user;
    if v_previous_role is null then
      insert into public.organization_memberships(organization_id,user_id,role)
      values(v_request.organization_id,v_user,'admin')
      on conflict (organization_id,user_id) do nothing;
    elsif v_previous_role <> 'owner' then
      update public.organization_memberships
        set role = 'admin'
        where organization_id = v_request.organization_id and user_id = v_user;
    end if;
    update public.site_management_requests
      set status = 'accepted', handled_by = v_user,
          previous_membership_role = v_previous_role,
          handled_at = now(), updated_at = now()
      where id = p_request_id returning * into v_request;
    return v_request;
  end if;

  if v_request.handled_by <> v_user then
    raise exception 'Seul le gestionnaire qui a accepté la demande peut modifier cette prise en charge.';
  end if;
  if p_status = 'in_progress' then
    if v_request.status <> 'accepted' then raise exception 'Seule une demande acceptée peut passer en cours.'; end if;
    update public.site_management_requests set status='in_progress', updated_at=now()
      where id=p_request_id returning * into v_request;
    return v_request;
  end if;
  if v_request.status not in ('accepted','in_progress') then
    raise exception 'Cette prise en charge n’est pas active.';
  end if;
  update public.site_management_requests
    set status='completed', handled_at=now(), updated_at=now()
    where id=p_request_id returning * into v_request;
  if not exists (
    select 1 from public.site_management_requests r
    where r.organization_id = v_request.organization_id
      and r.handled_by = v_user
      and r.status in ('accepted','in_progress')
  ) then
    if v_request.previous_membership_role is null then
      delete from public.organization_memberships
      where organization_id=v_request.organization_id and user_id=v_user;
    else
      update public.organization_memberships
        set role=v_request.previous_membership_role
        where organization_id=v_request.organization_id and user_id=v_user;
    end if;
  end if;
  return v_request;
end;
$$;

create or replace function public.revoke_site_management_request(p_request_id uuid)
returns public.site_management_requests
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_request public.site_management_requests;
begin
  if v_user is null then raise exception 'Connexion requise.'; end if;
  select * into v_request
  from public.site_management_requests
  where id=p_request_id
  for update;
  if not found then raise exception 'Demande introuvable.'; end if;
  if v_request.requested_by <> v_user or not exists (
    select 1 from public.organization_memberships m
    where m.organization_id=v_request.organization_id
      and m.user_id=v_user and m.role in ('owner','admin')
  ) then
    raise exception 'Seul le demandeur propriétaire ou administrateur peut retirer cette demande.';
  end if;
  if v_request.status not in ('pending','accepted','in_progress') then
    raise exception 'Cette demande ne peut plus être retirée.';
  end if;
  update public.site_management_requests
    set status='cancelled', updated_at=now(), handled_at=case when status='pending' then handled_at else now() end
    where id=p_request_id returning * into v_request;
  if v_request.handled_by is not null and not exists (
    select 1 from public.site_management_requests r
    where r.organization_id=v_request.organization_id
      and r.handled_by=v_request.handled_by
      and r.status in ('accepted','in_progress')
  ) then
    if v_request.previous_membership_role is null then
      delete from public.organization_memberships
      where organization_id=v_request.organization_id and user_id=v_request.handled_by;
    else
      update public.organization_memberships
        set role=v_request.previous_membership_role
        where organization_id=v_request.organization_id and user_id=v_request.handled_by;
    end if;
  end if;
  return v_request;
end;
$$;

revoke all on function public.respond_site_management_request(uuid,text) from public, anon;
grant execute on function public.respond_site_management_request(uuid,text) to authenticated;
revoke all on function public.revoke_site_management_request(uuid) from public, anon;
grant execute on function public.revoke_site_management_request(uuid) to authenticated;
