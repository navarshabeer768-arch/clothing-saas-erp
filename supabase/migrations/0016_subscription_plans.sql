-- =============================================================================
-- Migration: 0016_subscription_plans.sql
-- Purpose  : Phase 4 — SaaS Subscription Plans. Plans are platform-level
--            reference data managed by SaaS Admins; stores are linked to a
--            plan via store_subscriptions (0017), not by copying plan data
--            onto stores.
-- =============================================================================

create table if not exists public.subscription_plans (
  id                  uuid primary key default gen_random_uuid(),

  name                text not null,
  code                text not null,          -- e.g. 'TRIAL', 'STARTER', 'STANDARD', 'PRO', 'ENTERPRISE'
  description         text,

  monthly_price       numeric(12,2) not null default 0,
  yearly_price        numeric(12,2) not null default 0,
  currency_code       text not null default 'QAR',

  trial_days          integer not null default 0,

  max_users           integer,                -- null = unlimited
  max_branches        integer,
  max_products        integer,
  max_storage_mb      integer,

  status              text not null default 'active'
                       check (status in ('active', 'inactive', 'archived')),
  sort_order          integer not null default 0,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint subscription_plans_code_key unique (code),
  constraint subscription_plans_currency_len check (char_length(currency_code) = 3)
);

comment on table public.subscription_plans is
  'Platform-level subscription plan catalogue (Trial, Starter, Standard, Pro,
   Enterprise, ...). Managed by SaaS Admins. Stores link to a plan via
   store_subscriptions, never by copying plan fields onto stores.';

create index if not exists idx_subscription_plans_code on public.subscription_plans (code);
create index if not exists idx_subscription_plans_status on public.subscription_plans (status);

create trigger trg_subscription_plans_updated_at
  before update on public.subscription_plans
  for each row
  execute function public.set_updated_at();

alter table public.subscription_plans enable row level security;

-- -----------------------------------------------------------------------------
-- plan_features
-- Feature/module flags per plan, keyed by a stable string (e.g.
-- 'module.products', 'feature.loyalty') rather than hard-coding rules into
-- the frontend. limit_value is an optional numeric cap specific to that
-- feature (distinct from the plan-wide max_* columns above, which cover the
-- limits every plan needs regardless of feature toggles).
-- -----------------------------------------------------------------------------
create table if not exists public.plan_features (
  id                  uuid primary key default gen_random_uuid(),

  plan_id             uuid not null references public.subscription_plans (id) on delete cascade,
  feature_key         text not null,          -- e.g. 'module.products', 'feature.loyalty'
  enabled             boolean not null default true,
  limit_value         integer,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint plan_features_plan_key_key unique (plan_id, feature_key)
);

comment on table public.plan_features is
  'Per-plan feature/module toggles, keyed by a stable feature_key
   (module.products, feature.loyalty, ...). Future modules check this via
   has_store_feature()/requireStoreFeature() rather than hard-coded rules.';

create index if not exists idx_plan_features_plan_id on public.plan_features (plan_id);

create trigger trg_plan_features_updated_at
  before update on public.plan_features
  for each row
  execute function public.set_updated_at();

alter table public.plan_features enable row level security;

-- -----------------------------------------------------------------------------
-- Seed the platform's default plan catalogue as reference data (NOT
-- dev-only — every environment needs a Trial plan to exist for store
-- creation to auto-assign one). Idempotent via ON CONFLICT.
-- -----------------------------------------------------------------------------
insert into public.subscription_plans (name, code, description, monthly_price, yearly_price, currency_code, trial_days, max_users, max_branches, max_products, max_storage_mb, status, sort_order)
values
  ('Trial', 'TRIAL', 'Free trial with basic limits.', 0, 0, 'QAR', 14, 2, 1, 500, 1024, 'active', 0),
  ('Starter', 'STARTER', 'For small single-location stores.', 149, 1490, 'QAR', 0, 3, 1, 2000, 5120, 'active', 1),
  ('Standard', 'STANDARD', 'For growing stores with more staff.', 349, 3490, 'QAR', 0, 8, 2, 10000, 20480, 'active', 2),
  ('Professional', 'PRO', 'For multi-branch operations.', 699, 6990, 'QAR', 0, 20, 5, 50000, 51200, 'active', 3),
  ('Enterprise', 'ENTERPRISE', 'Custom limits for large operations.', 0, 0, 'QAR', 0, null, null, null, null, 'active', 4)
on conflict (code) do nothing;

-- Default feature set per plan. Trial/Starter get core modules only;
-- higher tiers unlock more. Future modules (loyalty, advanced reports,
-- multi-branch, exports) are already represented as keys even though the
-- modules themselves aren't built yet — Phase 5+ can wire them in without a
-- schema change.
insert into public.plan_features (plan_id, feature_key, enabled, limit_value)
select p.id, f.feature_key, f.enabled, f.limit_value
from public.subscription_plans p
cross join lateral (
  values
    ('module.products', true, null::integer),
    ('module.inventory', true, null::integer),
    ('module.pos', true, null::integer),
    ('module.purchases', p.code in ('STANDARD', 'PRO', 'ENTERPRISE'), null::integer),
    ('module.accounting', p.code in ('STANDARD', 'PRO', 'ENTERPRISE'), null::integer),
    ('feature.advanced_reports', p.code in ('PRO', 'ENTERPRISE'), null::integer),
    ('feature.loyalty', p.code in ('PRO', 'ENTERPRISE'), null::integer),
    ('feature.offers', p.code in ('STANDARD', 'PRO', 'ENTERPRISE'), null::integer),
    ('feature.multi_branch', p.code in ('PRO', 'ENTERPRISE'), null::integer),
    ('feature.exports', p.code <> 'TRIAL', null::integer),
    ('feature.barcode', true, null::integer)
) as f(feature_key, enabled, limit_value)
on conflict (plan_id, feature_key) do nothing;
