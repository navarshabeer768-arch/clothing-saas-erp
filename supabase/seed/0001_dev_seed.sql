-- =============================================================================
-- Seed: 0001_dev_seed.sql   [LOCAL DEVELOPMENT ONLY — DO NOT RUN IN PRODUCTION]
-- =============================================================================
-- This file is intentionally kept OUTSIDE supabase/migrations/ so it is never
-- picked up by `supabase db push` / automatic migration runners. Apply it
-- manually against your local/dev database only:
--
--   supabase db execute -f supabase/seed/0001_dev_seed.sql
--
-- All credentials below are throwaway, LOCAL-ONLY values. Change or delete
-- them before pointing this project at any shared or production database.
-- Passwords are pre-hashed placeholders (see note at bottom) — nothing here
-- is a usable real-world password, and the hashes below are not the actual
-- bcrypt output of the strings shown; they are illustrative only.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Basic permission catalogue required by this foundation.
--    Only foundational/admin-management permissions are seeded now — module
--    permissions (sales.*, inventory.*, etc.) are added when those modules
--    are actually built in later phases.
-- -----------------------------------------------------------------------------
insert into public.permissions (permission_key, module, action, description) values
  ('users.manage',        'administration', 'manage', 'Create, edit, disable store users'),
  ('roles.manage',        'administration', 'manage', 'Create, edit, assign roles and permissions'),
  ('store_settings.manage','administration', 'manage', 'View and edit store settings'),
  ('audit_logs.view',     'administration', 'view',   'View the store audit log')
on conflict (permission_key) do nothing;

-- -----------------------------------------------------------------------------
-- 2. One development SaaS admin.
--    login_id: dev_admin   password: (placeholder hash only, see note below)
-- -----------------------------------------------------------------------------
insert into public.saas_admins (login_id, password_hash, full_name, status)
values (
  'dev_admin',
  '$argon2id$DEV-PLACEHOLDER-HASH-REPLACE-BEFORE-USE$',
  'Local Dev SaaS Admin',
  'active'
)
on conflict (login_id) do nothing;

-- -----------------------------------------------------------------------------
-- 3. One test store.
-- -----------------------------------------------------------------------------
insert into public.stores (
  business_name, owner_name, mobile, address_line_1, city, country, currency_code, timezone, status
) values (
  'Dev Test Clothing Store', 'Dev Owner', '+974-0000-0000',
  '123 Test Street', 'Doha', 'Qatar', 'QAR', 'Asia/Qatar', 'active'
)
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- 4. Store Admin role for that test store + assign the seeded permissions.
-- -----------------------------------------------------------------------------
with dev_store as (
  select id from public.stores where business_name = 'Dev Test Clothing Store' limit 1
),
new_role as (
  insert into public.roles (store_id, name, description, is_system_role, status)
  select id, 'Store Admin', 'Full access within this store', false, 'active'
  from dev_store
  on conflict (store_id, name) do update set description = excluded.description
  returning id, store_id
)
insert into public.role_permissions (role_id, permission_id)
select new_role.id, permissions.id
from new_role
cross join public.permissions
on conflict (role_id, permission_id) do nothing;

-- -----------------------------------------------------------------------------
-- 5. One test store user (Store Admin) for the test store.
--    login_id: admin   password: (placeholder hash only, see note below)
-- -----------------------------------------------------------------------------
with dev_store as (
  select id from public.stores where business_name = 'Dev Test Clothing Store' limit 1
),
dev_role as (
  select id from public.roles where name = 'Store Admin'
    and store_id = (select id from dev_store) limit 1
)
insert into public.store_users (store_id, login_id, password_hash, full_name, role_id, status)
select
  dev_store.id,
  'admin',
  '$argon2id$DEV-PLACEHOLDER-HASH-REPLACE-BEFORE-USE$',
  'Dev Store Admin',
  dev_role.id,
  'active'
from dev_store, dev_role
on conflict (store_id, login_id) do nothing;

commit;

-- =============================================================================
-- NOTE ON PASSWORD HASHES
-- The password_hash values above are NOT real, usable hashes — they are
-- clearly-marked placeholders. Phase 2's server-side auth functions must
-- generate real Argon2id/bcrypt hashes (e.g. via the password-hashing helper
-- in server/lib) and this seed file must be updated to call that same
-- hashing logic (or you must UPDATE these rows locally with a real hash)
-- before you can actually log in against seeded data. Never commit a real,
-- reusable password or hash to source control.
-- =============================================================================
