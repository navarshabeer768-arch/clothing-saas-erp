-- =============================================================================
-- Migration: 0017_store_subscriptions.sql
-- Purpose  : Links stores to a subscription plan, and keeps an append-only
--            history of every change.
--
-- DESIGN DECISION — "one current subscription per store":
-- store_subscriptions has a UNIQUE constraint on store_id, so there is
-- exactly ONE row per store, ever. Renewals, plan changes, extensions, and
-- status changes UPDATE that row in place (current_period_start/end,
-- plan_id, status, etc.) rather than inserting a new "subscription" each
-- time. This trivially guarantees "a store cannot have multiple conflicting
-- active subscriptions" — there is structurally only one row to conflict
-- with. Full history of every change (old plan, new plan, old status, new
-- status, who did it, when) is preserved separately in
-- subscription_history, which IS append-only and grows over time. This
-- avoids the two-source-of-truth problem the spec warns about: the current
-- state lives in exactly one place (store_subscriptions), and everything
-- that ever happened lives in exactly one other place (subscription_history).
-- =============================================================================

create table if not exists public.store_subscriptions (
  id                    uuid primary key default gen_random_uuid(),

  store_id              uuid not null references public.stores (id) on delete cascade,
  plan_id               uuid not null references public.subscription_plans (id),

  status                text not null default 'trial'
                         check (status in ('trial', 'active', 'expired', 'suspended', 'cancelled')),
  billing_cycle         text not null default 'trial'
                         check (billing_cycle in ('trial', 'monthly', 'yearly', 'custom')),

  started_at            timestamptz not null default now(),
  trial_ends_at         timestamptz,

  current_period_start  timestamptz not null default now(),
  current_period_end    timestamptz not null,

  -- Optional grace period foundation (Phase 4 §35). Not exposed in any UI
  -- yet — schema-ready for a future phase to turn on without a migration.
  grace_period_days     integer not null default 0,

  expires_at            timestamptz,
  cancelled_at          timestamptz,
  notes                 text,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  created_by            uuid references public.saas_admins (id) on delete set null,

  constraint store_subscriptions_store_id_key unique (store_id)
);

comment on table public.store_subscriptions is
  'Exactly one row per store (unique store_id) — the CURRENT subscription
   state. Every change is applied in place here and separately logged to
   subscription_history. See migration header for the full rationale.';

create index if not exists idx_store_subscriptions_store_id on public.store_subscriptions (store_id);
create index if not exists idx_store_subscriptions_plan_id on public.store_subscriptions (plan_id);
create index if not exists idx_store_subscriptions_status on public.store_subscriptions (status);
create index if not exists idx_store_subscriptions_period_end on public.store_subscriptions (current_period_end);

create trigger trg_store_subscriptions_updated_at
  before update on public.store_subscriptions
  for each row
  execute function public.set_updated_at();

alter table public.store_subscriptions enable row level security;

-- -----------------------------------------------------------------------------
-- subscription_history — append-only, never updated or deleted.
-- -----------------------------------------------------------------------------
create table if not exists public.subscription_history (
  id                      uuid primary key default gen_random_uuid(),

  store_id                uuid not null references public.stores (id) on delete cascade,
  subscription_id         uuid references public.store_subscriptions (id) on delete set null,

  old_plan_id             uuid references public.subscription_plans (id),
  new_plan_id             uuid references public.subscription_plans (id),
  old_status              text,
  new_status              text not null,

  -- e.g. 'trial_started', 'plan_assigned', 'upgraded', 'downgraded',
  -- 'renewed', 'extended', 'suspended', 'expired', 'cancelled'
  action                  text not null,

  effective_at            timestamptz not null default now(),
  performed_by_saas_admin uuid references public.saas_admins (id) on delete set null,
  metadata                jsonb,

  created_at              timestamptz not null default now()
);

comment on table public.subscription_history is
  'Append-only audit trail of every subscription change. Never updated or
   deleted — this is the historical record store_subscriptions itself does
   not keep (that table only holds current state).';

create index if not exists idx_subscription_history_store_created on public.subscription_history (store_id, created_at);
create index if not exists idx_subscription_history_subscription_id on public.subscription_history (subscription_id);

alter table public.subscription_history enable row level security;
