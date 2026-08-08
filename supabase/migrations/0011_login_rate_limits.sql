-- =============================================================================
-- Migration: 0011_login_rate_limits.sql
-- Purpose  : Backend login rate limiting. Edge Functions are stateless
--            between invocations, so in-memory rate limiting doesn't work —
--            counts are tracked here instead, keyed by a coarse "scope" and
--            a time-bucketed window.
--
-- Design: a fixed-window counter per (scope, scope_key, window_start).
-- scope is one of 'ip', 'store_login' (store_id+login_id combined), or
-- 'saas_login' (saas admin login_id). This lets the login endpoint check
-- multiple independent limits (e.g. "this IP" AND "this specific account")
-- without one bad actor being able to lock out a legitimate user sharing
-- their IP, and without only relying on a per-account counter that a
-- distributed attacker could dodge by spreading attempts across accounts.
-- =============================================================================

create table if not exists public.login_rate_limits (
  id                  uuid primary key default gen_random_uuid(),

  scope               text not null check (scope in ('ip', 'store_login', 'saas_login')),
  scope_key           text not null,

  -- Fixed-window bucket start (e.g. truncated to the minute). The login
  -- endpoint computes this the same way on read and write.
  window_start        timestamptz not null,

  attempt_count        integer not null default 1,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint login_rate_limits_scope_key_window_key unique (scope, scope_key, window_start)
);

comment on table public.login_rate_limits is
  'Fixed-window login attempt counters for rate limiting, keyed by scope
   (ip | store_login | saas_login). Written only by trusted server-side
   login endpoints. Old rows can be pruned periodically (e.g. > 1 day old).';

create index if not exists idx_login_rate_limits_scope_key on public.login_rate_limits (scope, scope_key, window_start);

create trigger trg_login_rate_limits_updated_at
  before update on public.login_rate_limits
  for each row
  execute function public.set_updated_at();

alter table public.login_rate_limits enable row level security;
-- No anon/authenticated policies: written/read exclusively by trusted
-- server-side login logic using the service role.
