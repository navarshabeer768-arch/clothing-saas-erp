-- =============================================================================
-- Migration: 0012_saas_admin_lockout_fields.sql
-- Purpose  : Phase 1's saas_admins table didn't include failed-login lockout
--            tracking (only store_users did). Phase 2 needs the same
--            brute-force protection for SaaS admin accounts, so this adds
--            the matching columns. Forward migration — no data loss, all
--            new columns are nullable/defaulted.
-- =============================================================================

alter table public.saas_admins
  add column if not exists failed_login_attempts integer not null default 0,
  add column if not exists locked_until timestamptz;

comment on column public.saas_admins.failed_login_attempts is
  'Consecutive failed login attempts since the last success. Reset to 0 on successful login.';
comment on column public.saas_admins.locked_until is
  'If set and in the future, login is blocked until this time regardless of password correctness.';
