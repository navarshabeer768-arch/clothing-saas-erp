-- =============================================================================
-- Migration: 0007_store_users.sql
-- Purpose  : Users that belong to a specific store (cashiers, managers, etc).
--            Custom auth: login_id + password_hash, scoped uniquely per store.
-- =============================================================================

create table if not exists public.store_users (
  id                     uuid primary key default gen_random_uuid(),

  store_id               uuid not null references public.stores (id) on delete cascade,

  login_id               citext not null,
  password_hash          text not null,

  full_name              text not null,
  phone                  text,

  -- Prefer disabling a role over deleting it while users depend on it
  -- (enforced procedurally in Phase 2/3 application logic; see roles table).
  role_id                uuid references public.roles (id) on delete set null,

  status                 text not null default 'active'
                          check (status in ('active', 'disabled', 'locked')),

  -- Brute-force protection fields, used by the Phase 2 login endpoint.
  failed_login_attempts  integer not null default 0,
  locked_until           timestamptz,

  password_changed_at    timestamptz not null default now(),
  last_login_at          timestamptz,

  created_by             uuid references public.store_users (id) on delete set null,

  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  -- Username only needs to be unique WITHIN a store, so STORE-0001/admin and
  -- STORE-0002/admin can coexist, but STORE-0001/admin cannot be duplicated.
  constraint store_users_store_login_key unique (store_id, login_id)
);

comment on table public.store_users is
  'Users belonging to a single store. login_id is unique per store_id, not globally.';
comment on column public.store_users.password_hash is
  'Argon2id/bcrypt hash produced by a trusted server-side function. Never store or compare plain text.';

create index if not exists idx_store_users_store_id on public.store_users (store_id);
create index if not exists idx_store_users_store_login on public.store_users (store_id, login_id);
create index if not exists idx_store_users_status on public.store_users (status);
create index if not exists idx_store_users_role_id on public.store_users (role_id);

create trigger trg_store_users_updated_at
  before update on public.store_users
  for each row
  execute function public.set_updated_at();

alter table public.store_users enable row level security;
-- No anon/authenticated policies: reads/writes only via trusted server-side
-- endpoints. The application layer is responsible for scoping every query by
-- the store_id resolved from a verified session (never from client input).
