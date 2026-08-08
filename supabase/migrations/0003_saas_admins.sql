-- =============================================================================
-- Migration: 0003_saas_admins.sql
-- Purpose  : Platform-level administrators who control the entire SaaS system.
--            These are NOT store users. Authentication is custom (see docs).
-- =============================================================================

create table if not exists public.saas_admins (
  id                  uuid primary key default gen_random_uuid(),

  login_id            citext not null,
  password_hash       text not null,

  full_name           text not null,
  phone               text,

  status              text not null default 'active'
                       check (status in ('active', 'disabled')),

  last_login_at       timestamptz,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint saas_admins_login_id_key unique (login_id)
);

comment on table public.saas_admins is
  'Platform-level administrators. Distinct from store_users. Custom auth only — no Supabase Auth.';
comment on column public.saas_admins.password_hash is
  'Argon2id/bcrypt hash produced by a trusted server-side function. Never store or compare plain text.';

create index if not exists idx_saas_admins_status on public.saas_admins (status);

create trigger trg_saas_admins_updated_at
  before update on public.saas_admins
  for each row
  execute function public.set_updated_at();

-- Row Level Security: the anon/public key must never be able to read or write
-- this table directly. All access happens through trusted server-side
-- functions using the service role, which bypasses RLS by design. Enabling
-- RLS here with no permissive policies means the anon/authenticated roles are
-- hard-blocked at the database layer as defense-in-depth.
alter table public.saas_admins enable row level security;
-- Intentionally no policies are created: default-deny for anon/authenticated.
