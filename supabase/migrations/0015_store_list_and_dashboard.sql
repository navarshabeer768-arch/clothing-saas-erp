-- =============================================================================
-- Migration: 0015_store_list_and_dashboard.sql
-- Purpose  : Server-side search/filter/pagination for the SaaS store list,
--            and aggregate counts for the SaaS dashboard — both as SQL
--            functions so the Edge Functions issue one round-trip instead of
--            fetching everything and filtering/counting in JS.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- list_stores
-- Server-side search + filter + pagination. Returns a page of stores plus
-- each store's user counts and a total row count (for computing total pages)
-- in a single query.
-- -----------------------------------------------------------------------------
create or replace function public.list_stores(
  p_search text default null,
  p_status text default null,
  p_country text default null,
  p_page integer default 1,
  p_page_size integer default 20
)
returns table (
  id uuid,
  store_code text,
  business_name text,
  owner_name text,
  mobile text,
  country text,
  currency_code text,
  status text,
  created_at timestamptz,
  user_count bigint,
  total_count bigint
)
language sql
stable
as $$
  with filtered as (
    select s.*
    from public.stores s
    where (p_status is null or s.status = p_status)
      and (p_country is null or s.country = p_country)
      and (
        p_search is null or p_search = '' or
        s.store_code ilike '%' || p_search || '%' or
        s.business_name ilike '%' || p_search || '%' or
        s.owner_name ilike '%' || p_search || '%' or
        s.mobile ilike '%' || p_search || '%' or
        s.email::text ilike '%' || p_search || '%'
      )
  ),
  counted as (
    select count(*) as total from filtered
  )
  select
    f.id, f.store_code, f.business_name, f.owner_name, f.mobile, f.country,
    f.currency_code, f.status, f.created_at,
    coalesce(u.user_count, 0) as user_count,
    counted.total as total_count
  from filtered f
  left join (
    select store_id, count(*) as user_count from public.store_users group by store_id
  ) u on u.store_id = f.id
  cross join counted
  order by f.created_at desc
  limit greatest(p_page_size, 1)
  offset greatest(p_page - 1, 0) * greatest(p_page_size, 1);
$$;

comment on function public.list_stores is
  'Server-side searched/filtered/paginated store list for the SaaS Store
   Management UI. total_count is repeated on every row so the caller can
   compute total pages without a second query.';

-- -----------------------------------------------------------------------------
-- saas_dashboard_summary
-- Aggregate counts for the SaaS dashboard cards. One query, no N+1.
-- -----------------------------------------------------------------------------
create or replace function public.saas_dashboard_summary()
returns table (
  total_stores bigint,
  active_stores bigint,
  suspended_stores bigint,
  archived_stores bigint,
  inactive_stores bigint,
  total_store_users bigint,
  stores_created_this_month bigint
)
language sql
stable
as $$
  select
    (select count(*) from public.stores) as total_stores,
    (select count(*) from public.stores where status = 'active') as active_stores,
    (select count(*) from public.stores where status = 'suspended') as suspended_stores,
    (select count(*) from public.stores where status = 'archived') as archived_stores,
    (select count(*) from public.stores where status = 'inactive') as inactive_stores,
    (select count(*) from public.store_users) as total_store_users,
    (select count(*) from public.stores where date_trunc('month', created_at) = date_trunc('month', now())) as stores_created_this_month;
$$;

comment on function public.saas_dashboard_summary is
  'Single-query aggregate counts backing the SaaS dashboard cards.';
