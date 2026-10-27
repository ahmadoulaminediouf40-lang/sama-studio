begin;
create or replace function public.list_published_storefronts()
returns table(store_name text, store_slug text, template_id text, storefront_url text, published_at timestamptz)
language sql
stable
security definer
set search_path=public,pg_temp
as $function$
  select s.name,s.slug,s.template_id,s.published_url,s.published_at
  from public.sites s
  where s.status='published' and s.published_url is not null and s.published_url ~* '^https?://'
  order by s.published_at desc nulls last,s.name asc
  limit 100;
$function$;
revoke all on function public.list_published_storefronts() from public;
grant execute on function public.list_published_storefronts() to anon,authenticated;
commit;