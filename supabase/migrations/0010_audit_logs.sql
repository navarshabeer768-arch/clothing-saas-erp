-- =============================================================================
-- Migration: 0010_audit_logs.sql
-- Purpose  : Durable, server-persisted audit trail. Never rely on frontend
--            state for audit history — every important action must be written
--            here by trusted server-side logic.
-- =============================================================================

create table if not exists public.audit_logs (
  id                  uuid primary key default gen_random_uuid(),

  -- Nullable because platform-level events (e.g. a SaaS admin creating a
  -- store) are not scoped to any single store.
  store_id            uuid references public.stores (id) on delete set null,

  -- Exactly one of saas_admin_id / store_user_id is expected to be set for
  -- actor-attributed events; both may be null for system-generated events.
  saas_admin_id       uuid references public.saas_admins (id) on delete set null,
  store_user_id       uuid references public.store_users (id) on delete set null,

  module              text not null,
  action              text not null,

  entity_type         text,
  entity_id           uuid,

  old_values          jsonb,
  new_values          jsonb,
  metadata            jsonb,

  ip_address          text,

  created_at          timestamptz not null default now()
);

comment on table public.audit_logs is
  'Append-only audit trail. Written exclusively by trusted server-side logic.
   Examples of action values: login_success, login_failed, store_created,
   user_created, password_reset, role_changed, product_price_changed,
   stock_adjusted, invoice_cancelled.';

create index if not exists idx_audit_logs_store_created on public.audit_logs (store_id, created_at);
create index if not exists idx_audit_logs_module_action on public.audit_logs (module, action);
create index if not exists idx_audit_logs_entity on public.audit_logs (entity_type, entity_id);

alter table public.audit_logs enable row level security;
-- No anon/authenticated policies: audit_logs is written and read exclusively
-- through trusted server-side endpoints (service role), never directly from
-- the browser.
