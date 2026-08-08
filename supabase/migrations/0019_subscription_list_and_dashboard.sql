-- =============================================================================
-- Migration: 0019_subscription_list_and_dashboard.sql
-- Purpose  : Server-side list/search functions for the Plans and
--            Subscriptions pages, plus extended SaaS dashboard metrics
--            covering trial/expiring/expired subscription counts.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- list_plans_with_store_counts
-- -----------------------------------------------------------------------------
create or replace function public.list_plans_with_store_counts()
returns table (
  id uuid,
  name text,
  code text,
  description text,
  monthly_price numeric,
  yearly_price numeric,
  currency_code text,
  trial_days integer,
  max_users integer,
  max_branches integer,
  max_products integer,
  max_storage_mb integer,
  status text,
  sort_order integer,
  store_count bigint
)
language sql
stable
as $$
  select
    p.id, p.name, p.code, p.description, p.monthly_price, p.yearly_price, p.currency_code,
    p.trial_days, p.max_users, p.max_branches, p.max_products, p.max_storage_mb, p.status, p.sort_order,
    coalesce(s.store_count, 0) as store_count
  from public.subscription_plans p
  left join (
    select plan_id, count(*) as store_count from public.store_subscriptions group by plan_id
  ) s on s.plan_id = p.id
  order by p.sort_order, p.name;
$$;

comment on function public.list_plans_with_store_counts is
  'All plans with how many stores currently use each -- backs the /saas/plans list and the "used by N stores" edit warning.';

-- -----------------------------------------------------------------------------
-- list_store_subscriptions
-- -----------------------------------------------------------------------------
create or replace function public.list_store_subscriptions(
  p_search text default null,
  p_plan_id uuid default null,
  p_status text default null,
  p_billing_cycle text default null,
  p_expiring_within_days integer default null,
  p_page integer default 1,
  p_page_size integer default 20
)
returns table (
  store_id uuid,
  store_code text,
  business_name text,
  plan_id uuid,
  plan_name text,
  status text,
  effective_status text,
  billing_cycle text,
  started_at timestamptz,
  current_period_end timestamptz,
  days_remaining integer,
  total_count bigint
)
language sql
stable
as $$
  with base as (
    select
      s.id as store_id, s.store_code, s.business_name,
      sp.id as plan_id, sp.name as plan_name,
      ss.status, ss.billing_cycle, ss.started_at, ss.current_period_end,
      case
        when ss.status in ('suspended', 'cancelled') then ss.status
        when ss.current_period_end < now() then 'expired'
        else ss.status
      end as effective_status,
      greatest(0, ceil(extract(epoch from (ss.current_period_end - now())) / 86400))::integer as days_remaining
    from public.store_subscriptions ss
    join public.stores s on s.id = ss.store_id
    join public.subscription_plans sp on sp.id = ss.plan_id
  ),
  filtered as (
    select * from base
    where (p_plan_id is null or plan_id = p_plan_id)
      and (p_status is null or effective_status = p_status)
      and (p_billing_cycle is null or billing_cycle = p_billing_cycle)
      and (p_expiring_within_days is null or (days_remaining <= p_expiring_within_days and effective_status in ('trial', 'active')))
      and (
        p_search is null or p_search = '' or
        store_code ilike '%' || p_search || '%' or
        business_name ilike '%' || p_search || '%'
      )
  ),
  counted as (select count(*) as total from filtered)
  select f.*, counted.total
  from filtered f
  cross join counted
  order by f.current_period_end asc
  limit greatest(p_page_size, 1)
  offset greatest(p_page - 1, 0) * greatest(p_page_size, 1);
$$;

comment on function public.list_store_subscriptions is
  'Server-side searched/filtered/paginated subscription list for
   /saas/subscriptions, including an "expiring within N days" filter.';

-- -----------------------------------------------------------------------------
-- saas_subscription_dashboard_summary
-- -----------------------------------------------------------------------------
create or replace function public.saas_subscription_dashboard_summary()
returns table (
  trial_stores bigint,
  active_subscriptions bigint,
  expired_subscriptions bigint,
  expiring_within_7_days bigint,
  expiring_within_30_days bigint
)
language sql
stable
as $$
  with computed as (
    select
      case
        when status in ('suspended', 'cancelled') then status
        when current_period_end < now() then 'expired'
        else status
      end as effective_status,
      current_period_end
    from public.store_subscriptions
  )
  select
    (select count(*) from computed where effective_status = 'trial') as trial_stores,
    (select count(*) from computed where effective_status = 'active') as active_subscriptions,
    (select count(*) from computed where effective_status = 'expired') as expired_subscriptions,
    (select count(*) from computed where effective_status in ('trial','active') and current_period_end < now() + interval '7 days') as expiring_within_7_days,
    (select count(*) from computed where effective_status in ('trial','active') and current_period_end < now() + interval '30 days') as expiring_within_30_days;
$$;

comment on function public.saas_subscription_dashboard_summary is
  'Subscription-specific counts (trial/active/expired/expiring soon) for the SaaS dashboard.';
