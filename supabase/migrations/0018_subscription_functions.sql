-- =============================================================================
-- Migration: 0018_subscription_functions.sql
-- Purpose  : Atomic subscription management operations, plan-limit and
--            feature-access helpers, and extending create_store_with_admin
--            to auto-assign a subscription (Trial by default) atomically
--            with store creation.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- assign_store_subscription
-- Creates or replaces a store's ONE subscription row (see 0017 header for
-- why this is an upsert, not an insert-only history). Used directly for
-- initial assignment, and as the building block other functions below call.
-- -----------------------------------------------------------------------------
create or replace function public.assign_store_subscription(
  p_store_id uuid,
  p_plan_id uuid,
  p_billing_cycle text,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_status text,
  p_saas_admin_id uuid,
  p_action text,
  p_notes text default null,
  p_trial_ends_at timestamptz default null
)
returns uuid
language plpgsql
as $$
declare
  v_subscription_id uuid;
  v_old_plan_id uuid;
  v_old_status text;
begin
  select id, plan_id, status into v_subscription_id, v_old_plan_id, v_old_status
  from public.store_subscriptions where store_id = p_store_id;

  if v_subscription_id is null then
    insert into public.store_subscriptions (
      store_id, plan_id, status, billing_cycle, started_at, trial_ends_at,
      current_period_start, current_period_end, notes, created_by
    ) values (
      p_store_id, p_plan_id, p_status, p_billing_cycle, now(), p_trial_ends_at,
      p_period_start, p_period_end, p_notes, p_saas_admin_id
    )
    returning id into v_subscription_id;
  else
    update public.store_subscriptions set
      plan_id = p_plan_id,
      status = p_status,
      billing_cycle = p_billing_cycle,
      trial_ends_at = coalesce(p_trial_ends_at, trial_ends_at),
      current_period_start = p_period_start,
      current_period_end = p_period_end,
      notes = coalesce(p_notes, notes),
      cancelled_at = case when p_status = 'cancelled' then now() else null end
    where id = v_subscription_id;
  end if;

  insert into public.subscription_history (
    store_id, subscription_id, old_plan_id, new_plan_id, old_status, new_status,
    action, performed_by_saas_admin, metadata
  ) values (
    p_store_id, v_subscription_id, v_old_plan_id, p_plan_id, v_old_status, p_status,
    p_action, p_saas_admin_id, jsonb_build_object('periodStart', p_period_start, 'periodEnd', p_period_end)
  );

  insert into public.audit_logs (store_id, saas_admin_id, module, action, entity_type, entity_id, new_values)
  values (p_store_id, p_saas_admin_id, 'saas_subscription_management', p_action, 'store_subscription', v_subscription_id,
    jsonb_build_object('planId', p_plan_id, 'status', p_status));

  return v_subscription_id;
end;
$$;

comment on function public.assign_store_subscription is
  'Creates or updates the store''s single current subscription row, logs the
   change to subscription_history, and writes an audit entry. Atomic.';

-- -----------------------------------------------------------------------------
-- renew_store_subscription
-- -----------------------------------------------------------------------------
create or replace function public.renew_store_subscription(
  p_store_id uuid,
  p_period_end timestamptz,
  p_billing_cycle text,
  p_saas_admin_id uuid,
  p_notes text default null
)
returns uuid
language plpgsql
as $$
declare
  v_current_end timestamptz;
  v_plan_id uuid;
  v_period_start timestamptz;
begin
  select current_period_end, plan_id into v_current_end, v_plan_id
  from public.store_subscriptions where store_id = p_store_id;

  if v_plan_id is null then
    raise exception 'store has no subscription to renew: %', p_store_id;
  end if;

  v_period_start := greatest(coalesce(v_current_end, now()), now());

  return public.assign_store_subscription(
    p_store_id, v_plan_id, p_billing_cycle, v_period_start, p_period_end, 'active',
    p_saas_admin_id, 'subscription_renewed', p_notes
  );
end;
$$;

comment on function public.renew_store_subscription is
  'Renews a store''s current plan for a new period. If the previous period
   has not yet ended, the new period starts from the old end date rather
   than "now" so paid time is never lost.';

-- -----------------------------------------------------------------------------
-- extend_store_subscription
-- -----------------------------------------------------------------------------
create or replace function public.extend_store_subscription(
  p_store_id uuid,
  p_new_period_end timestamptz,
  p_saas_admin_id uuid,
  p_reason text default null
)
returns uuid
language plpgsql
as $$
declare
  v_subscription_id uuid;
  v_plan_id uuid;
  v_status text;
  v_old_period_end timestamptz;
begin
  select id, plan_id, status, current_period_end
  into v_subscription_id, v_plan_id, v_status, v_old_period_end
  from public.store_subscriptions where store_id = p_store_id;

  if v_subscription_id is null then
    raise exception 'store has no subscription to extend: %', p_store_id;
  end if;

  update public.store_subscriptions
  set current_period_end = p_new_period_end,
      status = case when status = 'expired' then 'active' else status end
  where id = v_subscription_id;

  insert into public.subscription_history (
    store_id, subscription_id, old_plan_id, new_plan_id, old_status, new_status, action, performed_by_saas_admin, metadata
  ) values (
    p_store_id, v_subscription_id, v_plan_id, v_plan_id, v_status,
    case when v_status = 'expired' then 'active' else v_status end,
    'subscription_extended', p_saas_admin_id,
    jsonb_build_object('previousPeriodEnd', v_old_period_end, 'newPeriodEnd', p_new_period_end, 'reason', p_reason)
  );

  insert into public.audit_logs (store_id, saas_admin_id, module, action, entity_type, entity_id, old_values, new_values)
  values (p_store_id, p_saas_admin_id, 'saas_subscription_management', 'subscription_extended', 'store_subscription', v_subscription_id,
    jsonb_build_object('periodEnd', v_old_period_end), jsonb_build_object('periodEnd', p_new_period_end));

  return v_subscription_id;
end;
$$;

comment on function public.extend_store_subscription is
  'Pushes a store''s current_period_end forward (or to a custom date)
   without changing its plan. Reactivates an expired subscription. Records
   previous/new expiry, the acting admin, and an optional reason.';

-- -----------------------------------------------------------------------------
-- change_store_subscription_plan
-- -----------------------------------------------------------------------------
create or replace function public.change_store_subscription_plan(
  p_store_id uuid,
  p_new_plan_id uuid,
  p_billing_cycle text,
  p_period_end timestamptz,
  p_saas_admin_id uuid,
  p_notes text default null
)
returns uuid
language plpgsql
as $$
begin
  return public.assign_store_subscription(
    p_store_id, p_new_plan_id, p_billing_cycle, now(), p_period_end, 'active',
    p_saas_admin_id, 'subscription_changed', p_notes
  );
end;
$$;

comment on function public.change_store_subscription_plan is
  'Changes a store''s plan (upgrade or downgrade), starting a new period
   immediately. Phase 4 applies plan changes immediately per spec §29.';

-- -----------------------------------------------------------------------------
-- set_subscription_status (distinct from set_store_status — see Phase 4 §33)
-- -----------------------------------------------------------------------------
create or replace function public.set_subscription_status(
  p_store_id uuid,
  p_new_status text,
  p_saas_admin_id uuid,
  p_notes text default null
)
returns uuid
language plpgsql
as $$
declare
  v_subscription_id uuid;
  v_plan_id uuid;
  v_old_status text;
begin
  if p_new_status not in ('trial', 'active', 'expired', 'suspended', 'cancelled') then
    raise exception 'invalid subscription status: %', p_new_status;
  end if;

  select id, plan_id, status into v_subscription_id, v_plan_id, v_old_status
  from public.store_subscriptions where store_id = p_store_id;

  if v_subscription_id is null then
    raise exception 'store has no subscription: %', p_store_id;
  end if;

  update public.store_subscriptions
  set status = p_new_status,
      cancelled_at = case when p_new_status = 'cancelled' then now() else cancelled_at end,
      notes = coalesce(p_notes, notes)
  where id = v_subscription_id;

  insert into public.subscription_history (
    store_id, subscription_id, old_plan_id, new_plan_id, old_status, new_status, action, performed_by_saas_admin, metadata
  ) values (
    p_store_id, v_subscription_id, v_plan_id, v_plan_id, v_old_status, p_new_status,
    'subscription_' || p_new_status, p_saas_admin_id, jsonb_build_object('notes', p_notes)
  );

  insert into public.audit_logs (store_id, saas_admin_id, module, action, entity_type, entity_id, old_values, new_values)
  values (p_store_id, p_saas_admin_id, 'saas_subscription_management', 'subscription_' || p_new_status, 'store_subscription', v_subscription_id,
    jsonb_build_object('status', v_old_status), jsonb_build_object('status', p_new_status));

  return v_subscription_id;
end;
$$;

comment on function public.set_subscription_status is
  'Suspends/cancels/reactivates a SUBSCRIPTION (not the store itself — a
   store can stay active while its subscription is suspended/expired).';

-- -----------------------------------------------------------------------------
-- get_store_subscription_context
-- -----------------------------------------------------------------------------
create or replace function public.get_store_subscription_context(p_store_id uuid)
returns table (
  subscription_id uuid,
  plan_id uuid,
  plan_name text,
  plan_code text,
  status text,
  effective_status text,
  billing_cycle text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  days_remaining integer,
  max_users integer,
  max_branches integer,
  max_products integer,
  max_storage_mb integer,
  feature_keys text[]
)
language sql
stable
as $$
  select
    ss.id, sp.id, sp.name, sp.code, ss.status,
    case
      when ss.status in ('suspended', 'cancelled') then ss.status
      when ss.current_period_end < now() then 'expired'
      else ss.status
    end as effective_status,
    ss.billing_cycle, ss.current_period_start, ss.current_period_end,
    greatest(0, ceil(extract(epoch from (ss.current_period_end - now())) / 86400))::integer as days_remaining,
    sp.max_users, sp.max_branches, sp.max_products, sp.max_storage_mb,
    coalesce(
      (select array_agg(pf.feature_key) from public.plan_features pf where pf.plan_id = sp.id and pf.enabled),
      array[]::text[]
    ) as feature_keys
  from public.store_subscriptions ss
  join public.subscription_plans sp on sp.id = ss.plan_id
  where ss.store_id = p_store_id;
$$;

comment on function public.get_store_subscription_context is
  'Everything the session layer / store details page needs about a store''s
   subscription in one query. effective_status computes expiry on read
   (current_period_end < now()) so a stale stored status can never grant
   access past the paid period, even before any scheduled job updates it.';

-- -----------------------------------------------------------------------------
-- check_plan_limit
-- -----------------------------------------------------------------------------
create or replace function public.check_plan_limit(p_store_id uuid, p_limit_key text)
returns table (current_count integer, limit_value integer, allowed boolean)
language plpgsql
stable
as $$
declare
  v_current integer;
  v_limit integer;
begin
  select
    case p_limit_key
      when 'users' then (select count(*)::integer from public.store_users where store_id = p_store_id)
      else null
    end,
    case p_limit_key
      when 'users' then (select sp.max_users from public.store_subscriptions ss join public.subscription_plans sp on sp.id = ss.plan_id where ss.store_id = p_store_id)
      when 'branches' then (select sp.max_branches from public.store_subscriptions ss join public.subscription_plans sp on sp.id = ss.plan_id where ss.store_id = p_store_id)
      when 'products' then (select sp.max_products from public.store_subscriptions ss join public.subscription_plans sp on sp.id = ss.plan_id where ss.store_id = p_store_id)
      else null
    end
  into v_current, v_limit;

  return query select v_current, v_limit, (v_limit is null or v_current < v_limit);
end;
$$;

comment on function public.check_plan_limit is
  'Generic plan-limit check. limit_value NULL means unlimited (allowed is
   always true). "users" is wired against real data now; "branches"/
   "products" return the plan limit with current_count NULL until those
   modules exist (Phase 5+ fills in the counting logic).';

-- -----------------------------------------------------------------------------
-- has_store_feature
-- -----------------------------------------------------------------------------
create or replace function public.has_store_feature(p_store_id uuid, p_feature_key text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.store_subscriptions ss
    join public.plan_features pf on pf.plan_id = ss.plan_id
    where ss.store_id = p_store_id
      and pf.feature_key = p_feature_key
      and pf.enabled = true
  );
$$;

comment on function public.has_store_feature is
  'True if the store''s current plan has the given feature_key enabled.
   Used by future modules'' requireStoreFeature() backend guard.';

-- -----------------------------------------------------------------------------
-- Extend create_store_with_admin (Phase 3) with trailing optional params so
-- existing callers keep working unchanged. If p_plan_id is omitted, the
-- TRIAL plan is looked up by code and assigned with its configured
-- trial_days — "Recommended default: Trial plan".
-- -----------------------------------------------------------------------------
create or replace function public.create_store_with_admin(
  p_business_name text,
  p_legal_name text,
  p_owner_name text,
  p_mobile text,
  p_whatsapp text,
  p_email text,
  p_address_line_1 text,
  p_address_line_2 text,
  p_city text,
  p_state text,
  p_country text,
  p_postal_code text,
  p_currency_code text,
  p_timezone text,
  p_tax_number text,
  p_created_by uuid,
  p_admin_full_name text,
  p_admin_login_id text,
  p_admin_password_hash text,
  p_admin_phone text,
  p_plan_id uuid default null,
  p_billing_cycle text default null
)
returns table (
  store_id uuid,
  store_code text,
  admin_user_id uuid,
  role_id uuid,
  subscription_id uuid
)
language plpgsql
as $$
declare
  v_store_id uuid;
  v_store_code text;
  v_role_id uuid;
  v_admin_user_id uuid;
  v_permission_ids uuid[];
  v_plan_id uuid;
  v_trial_days integer;
  v_billing_cycle text;
  v_subscription_id uuid;
begin
  insert into public.stores (
    business_name, legal_name, owner_name, mobile, whatsapp, email,
    address_line_1, address_line_2, city, state, country, postal_code,
    currency_code, timezone, tax_number, status, created_by
  ) values (
    p_business_name, nullif(p_legal_name, ''), p_owner_name, p_mobile, nullif(p_whatsapp, ''), nullif(p_email, ''),
    p_address_line_1, nullif(p_address_line_2, ''), nullif(p_city, ''), nullif(p_state, ''), p_country, nullif(p_postal_code, ''),
    p_currency_code, p_timezone, nullif(p_tax_number, ''), 'active', p_created_by
  )
  returning id, stores.store_code into v_store_id, v_store_code;

  select id into v_role_id from public.roles where store_id = v_store_id and name = 'Store Admin';
  if v_role_id is null then
    insert into public.roles (store_id, name, description, is_system_role, status)
    values (v_store_id, 'Store Admin', 'Full access within this store', false, 'active')
    returning id into v_role_id;
  end if;

  select array_agg(id) into v_permission_ids from public.permissions;
  if v_permission_ids is not null then
    insert into public.role_permissions (role_id, permission_id)
    select v_role_id, unnest(v_permission_ids)
    on conflict (role_id, permission_id) do nothing;
  end if;

  insert into public.store_users (store_id, login_id, password_hash, full_name, phone, role_id, status, created_by)
  values (v_store_id, p_admin_login_id, p_admin_password_hash, p_admin_full_name, nullif(p_admin_phone, ''), v_role_id, 'active', null)
  returning id into v_admin_user_id;

  insert into public.store_settings (store_id, setting_key, setting_value)
  values (v_store_id, 'general', '{}'::jsonb)
  on conflict (store_id, setting_key) do nothing;

  -- --- Phase 4: subscription assignment ---
  v_plan_id := p_plan_id;
  if v_plan_id is null then
    select id, trial_days into v_plan_id, v_trial_days from public.subscription_plans where code = 'TRIAL';
  else
    select trial_days into v_trial_days from public.subscription_plans where id = v_plan_id;
  end if;

  if v_plan_id is not null then
    v_billing_cycle := coalesce(p_billing_cycle, case when p_plan_id is null then 'trial' else 'monthly' end);

    insert into public.store_subscriptions (
      store_id, plan_id, status, billing_cycle, started_at, trial_ends_at, current_period_start, current_period_end, created_by
    ) values (
      v_store_id, v_plan_id,
      case when v_billing_cycle = 'trial' then 'trial' else 'active' end,
      v_billing_cycle, now(),
      case when v_billing_cycle = 'trial' then now() + make_interval(days => coalesce(v_trial_days, 14)) else null end,
      now(),
      case when v_billing_cycle = 'trial' then now() + make_interval(days => coalesce(v_trial_days, 14))
           when v_billing_cycle = 'yearly' then now() + interval '1 year'
           else now() + interval '1 month' end,
      p_created_by
    )
    returning id into v_subscription_id;

    insert into public.subscription_history (store_id, subscription_id, new_plan_id, new_status, action, performed_by_saas_admin)
    values (v_store_id, v_subscription_id, v_plan_id, case when v_billing_cycle = 'trial' then 'trial' else 'active' end, 'trial_started', p_created_by);
  end if;

  insert into public.audit_logs (store_id, saas_admin_id, module, action, entity_type, entity_id, new_values)
  values (v_store_id, p_created_by, 'saas_store_management', 'store_created', 'store', v_store_id,
    jsonb_build_object('storeCode', v_store_code, 'businessName', p_business_name, 'planId', v_plan_id));

  return query select v_store_id, v_store_code, v_admin_user_id, v_role_id, v_subscription_id;
end;
$$;

comment on function public.create_store_with_admin is
  'Atomically creates a store, its Store Admin role + permissions, the
   initial Store Admin user, default settings, AND a subscription (the
   given plan, or TRIAL by default) with its history entry, plus the store
   audit entry. One transaction — any exception rolls back everything,
   including the subscription.';
