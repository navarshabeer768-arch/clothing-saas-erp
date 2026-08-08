-- =============================================================================
-- Migration: 0013_auth_helper_functions.sql
-- Purpose  : Atomic, race-condition-safe helper functions used by the Phase 2
--            login endpoints. Doing these as single SQL statements (upsert /
--            update ... returning) avoids read-then-write races that plain
--            "select count, then update" application code would have under
--            concurrent login attempts (e.g. two parallel brute-force
--            requests both reading failed_login_attempts=4 and only one
--            increment landing).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- increment_login_rate_limit
-- Atomically increments (or creates) the counter for a given scope/key/window
-- and returns the resulting count. Callers compare the returned count against
-- their configured threshold.
-- -----------------------------------------------------------------------------
create or replace function public.increment_login_rate_limit(
  p_scope text,
  p_scope_key text,
  p_window_start timestamptz
)
returns integer
language sql
as $$
  insert into public.login_rate_limits (scope, scope_key, window_start, attempt_count)
  values (p_scope, p_scope_key, p_window_start, 1)
  on conflict (scope, scope_key, window_start)
  do update set attempt_count = public.login_rate_limits.attempt_count + 1
  returning attempt_count;
$$;

comment on function public.increment_login_rate_limit(text, text, timestamptz) is
  'Atomically increments the login attempt counter for (scope, scope_key,
   window_start), creating the row if needed. Returns the new count.';

-- -----------------------------------------------------------------------------
-- register_store_user_failed_login
-- Atomically increments failed_login_attempts for a store_user and, if the
-- new count reaches p_lock_threshold, sets locked_until p_lock_minutes from
-- now. Returns the resulting (attempts, locked_until) as a row.
-- -----------------------------------------------------------------------------
create or replace function public.register_store_user_failed_login(
  p_store_user_id uuid,
  p_lock_threshold integer default 5,
  p_lock_minutes integer default 15
)
returns table (failed_login_attempts integer, locked_until timestamptz)
language sql
as $$
  update public.store_users
  set
    failed_login_attempts = public.store_users.failed_login_attempts + 1,
    locked_until = case
      when public.store_users.failed_login_attempts + 1 >= p_lock_threshold
        then now() + make_interval(mins => p_lock_minutes)
      else public.store_users.locked_until
    end
  where id = p_store_user_id
  returning public.store_users.failed_login_attempts, public.store_users.locked_until;
$$;

comment on function public.register_store_user_failed_login(uuid, integer, integer) is
  'Atomically increments a store_user''s failed_login_attempts and applies a
   temporary lock once the threshold is reached. Default: lock for 15 minutes
   after 5 consecutive failures.';

-- -----------------------------------------------------------------------------
-- reset_store_user_login_state
-- Called after a successful login: clears failure counters/lock and stamps
-- last_login_at.
-- -----------------------------------------------------------------------------
create or replace function public.reset_store_user_login_state(p_store_user_id uuid)
returns void
language sql
as $$
  update public.store_users
  set failed_login_attempts = 0,
      locked_until = null,
      last_login_at = now()
  where id = p_store_user_id;
$$;

comment on function public.reset_store_user_login_state(uuid) is
  'Clears failed_login_attempts/locked_until and stamps last_login_at after a successful store_user login.';

-- -----------------------------------------------------------------------------
-- Same pair for saas_admins.
-- -----------------------------------------------------------------------------
create or replace function public.register_saas_admin_failed_login(
  p_saas_admin_id uuid,
  p_lock_threshold integer default 5,
  p_lock_minutes integer default 15
)
returns table (failed_login_attempts integer, locked_until timestamptz)
language sql
as $$
  update public.saas_admins
  set
    failed_login_attempts = public.saas_admins.failed_login_attempts + 1,
    locked_until = case
      when public.saas_admins.failed_login_attempts + 1 >= p_lock_threshold
        then now() + make_interval(mins => p_lock_minutes)
      else public.saas_admins.locked_until
    end
  where id = p_saas_admin_id
  returning public.saas_admins.failed_login_attempts, public.saas_admins.locked_until;
$$;

comment on function public.register_saas_admin_failed_login(uuid, integer, integer) is
  'Atomically increments a saas_admin''s failed_login_attempts and applies a
   temporary lock once the threshold is reached.';

create or replace function public.reset_saas_admin_login_state(p_saas_admin_id uuid)
returns void
language sql
as $$
  update public.saas_admins
  set failed_login_attempts = 0,
      locked_until = null,
      last_login_at = now()
  where id = p_saas_admin_id;
$$;

comment on function public.reset_saas_admin_login_state(uuid) is
  'Clears failed_login_attempts/locked_until and stamps last_login_at after a successful saas_admin login.';
