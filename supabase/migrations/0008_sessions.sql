-- =============================================================================
-- Migration: 0008_sessions.sql
-- Purpose  : Server-managed session storage for the custom auth system.
--
-- DESIGN DECISION (documented per Phase-1 spec §15):
-- We use TWO separate, strongly-typed session tables instead of one
-- polymorphic "user_sessions" table with a nullable user_id/admin_id pair.
--
-- Why:
--   - A single polymorphic table (user_id + session_type discriminator, no
--     real FK) cannot enforce referential integrity at the database level —
--     a bad session_type or mismatched id would silently point nowhere.
--   - saas_admins and store_users are different entities with different
--     lifecycles, blast radii, and security sensitivity (a platform-admin
--     session compromise is far more severe than a single store's cashier
--     session). Keeping them in separate tables makes it impossible for a
--     bug to accidentally treat one kind of session as the other.
--   - Real foreign keys + real CASCADE behavior are available on both
--     tables, which is not possible with a single polymorphic user_id column.
--
-- A thin view (public.v_all_sessions) is provided below for the rare cases
-- (admin dashboards, audit tooling) that want a unified read-only look
-- across both tables.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- store_user_sessions
-- -----------------------------------------------------------------------------
create table if not exists public.store_user_sessions (
  id                  uuid primary key default gen_random_uuid(),

  store_user_id       uuid not null references public.store_users (id) on delete cascade,
  store_id            uuid not null references public.stores (id) on delete cascade,

  -- Only a SHA-256 (or similar) hash of the opaque session token is stored.
  -- The raw token is returned to the client exactly once at login time and
  -- never persisted server-side.
  token_hash          text not null,

  created_at          timestamptz not null default now(),
  expires_at          timestamptz not null,
  last_activity_at    timestamptz not null default now(),
  revoked_at          timestamptz,

  ip_address          text,
  user_agent          text,
  device_name         text,

  constraint store_user_sessions_token_hash_key unique (token_hash)
);

comment on table public.store_user_sessions is
  'Server-side sessions for store_users. Only a hash of the session token is stored.';

create index if not exists idx_store_user_sessions_user_id on public.store_user_sessions (store_user_id);
create index if not exists idx_store_user_sessions_store_id on public.store_user_sessions (store_id);
create index if not exists idx_store_user_sessions_token_hash on public.store_user_sessions (token_hash);
create index if not exists idx_store_user_sessions_expires_at on public.store_user_sessions (expires_at);

alter table public.store_user_sessions enable row level security;

-- -----------------------------------------------------------------------------
-- saas_admin_sessions
-- -----------------------------------------------------------------------------
create table if not exists public.saas_admin_sessions (
  id                  uuid primary key default gen_random_uuid(),

  saas_admin_id       uuid not null references public.saas_admins (id) on delete cascade,

  token_hash          text not null,

  created_at          timestamptz not null default now(),
  expires_at          timestamptz not null,
  last_activity_at    timestamptz not null default now(),
  revoked_at          timestamptz,

  ip_address          text,
  user_agent          text,
  device_name         text,

  constraint saas_admin_sessions_token_hash_key unique (token_hash)
);

comment on table public.saas_admin_sessions is
  'Server-side sessions for saas_admins. Only a hash of the session token is stored.';

create index if not exists idx_saas_admin_sessions_admin_id on public.saas_admin_sessions (saas_admin_id);
create index if not exists idx_saas_admin_sessions_token_hash on public.saas_admin_sessions (token_hash);
create index if not exists idx_saas_admin_sessions_expires_at on public.saas_admin_sessions (expires_at);

alter table public.saas_admin_sessions enable row level security;

-- -----------------------------------------------------------------------------
-- Unified read-only view (optional convenience for cross-cutting tooling).
-- session_type mirrors the "session_type" concept requested in the spec
-- while keeping the underlying storage strongly typed and normalized.
-- -----------------------------------------------------------------------------
create or replace view public.v_all_sessions as
select
  id,
  'store_user'::text as session_type,
  store_user_id as principal_id,
  store_id,
  token_hash,
  created_at,
  expires_at,
  last_activity_at,
  revoked_at,
  ip_address,
  user_agent,
  device_name
from public.store_user_sessions
union all
select
  id,
  'saas_admin'::text as session_type,
  saas_admin_id as principal_id,
  null::uuid as store_id,
  token_hash,
  created_at,
  expires_at,
  last_activity_at,
  revoked_at,
  ip_address,
  user_agent,
  device_name
from public.saas_admin_sessions;

comment on view public.v_all_sessions is
  'Read-only union of store_user_sessions and saas_admin_sessions for cross-cutting tooling/audits.';
