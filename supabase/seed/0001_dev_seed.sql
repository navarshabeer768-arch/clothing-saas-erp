-- =============================================================================
-- Seed: 0001_dev_seed.sql   [LOCAL DEVELOPMENT ONLY — DO NOT RUN IN PRODUCTION]
-- =============================================================================
-- Outside supabase/migrations/ so it is never picked up by automatic
-- migration runners. Apply manually against your local/dev database:
--
--   supabase db execute -f supabase/seed/0001_dev_seed.sql
--
-- CREDENTIALS BELOW ARE FOR LOCAL/DEV TESTING ONLY. They are real, working
-- bcrypt hashes (generated with scripts/hash-password.mjs, same cost factor
-- as supabase/functions/_shared/password.ts) so login actually works out of
-- the box in a fresh dev database — but the plain-text passwords are
-- obviously weak, are printed right here in this file, and MUST be changed
-- (via change-password) or this seed skipped entirely before this project
-- ever points at a real/shared/production database.
--
-- To regenerate a hash for a different password:
--   node scripts/hash-password.mjs "YourNewPassword"
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Basic permission catalogue required by this foundation.
-- -----------------------------------------------------------------------------
insert into public.permissions (permission_key, module, action, description) values
  ('users.manage',         'administration', 'manage', 'Create, edit, disable store users'),
  ('roles.manage',         'administration', 'manage', 'Create, edit, assign roles and permissions'),
  ('store_settings.manage','administration', 'manage', 'View and edit store settings'),
  ('audit_logs.view',      'administration', 'view',   'View the store audit log')
on conflict (permission_key) do nothing;

-- -----------------------------------------------------------------------------
-- 2. One development SaaS admin.
--    login_id: dev_admin   password: DevAdmin123!   (LOCAL DEV ONLY)
-- -----------------------------------------------------------------------------
insert into public.saas_admins (login_id, password_hash, full_name, status)
values (
  'dev_admin',
  '$2b$12$1obQz/lyGVxScMyg53DrKOynnQHdWiXBmy1iMiq9ACJFnEEQIrc.a',
  'Local Dev SaaS Admin',
  'active'
)
on conflict (login_id) do nothing;

-- -----------------------------------------------------------------------------
-- 3. TWO development stores, for multi-tenant login testing (Phase 2 §41):
--    the same login_id ("admin") exists in both, and must only ever resolve
--    to its own store.
-- -----------------------------------------------------------------------------
insert into public.stores (
  business_name, owner_name, mobile, address_line_1, city, country, currency_code, timezone, status
) values (
  'Demo Clothing Store', 'Dev Owner One', '+974-0000-0001',
  '123 Test Street', 'Doha', 'Qatar', 'QAR', 'Asia/Qatar', 'active'
)
on conflict do nothing;

insert into public.stores (
  business_name, owner_name, mobile, address_line_1, city, country, currency_code, timezone, status
) values (
  'Fashion Hub', 'Dev Owner Two', '+974-0000-0002',
  '456 Test Avenue', 'Doha', 'Qatar', 'QAR', 'Asia/Qatar', 'active'
)
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- 4. Store Admin role + permissions, per store.
-- -----------------------------------------------------------------------------
with target_store as (
  select id from public.stores where business_name = 'Demo Clothing Store' limit 1
),
new_role as (
  insert into public.roles (store_id, name, description, is_system_role, status)
  select id, 'Store Admin', 'Full access within this store', false, 'active'
  from target_store
  on conflict (store_id, name) do update set description = excluded.description
  returning id
)
insert into public.role_permissions (role_id, permission_id)
select new_role.id, permissions.id from new_role cross join public.permissions
on conflict (role_id, permission_id) do nothing;

with target_store as (
  select id from public.stores where business_name = 'Fashion Hub' limit 1
),
new_role as (
  insert into public.roles (store_id, name, description, is_system_role, status)
  select id, 'Store Admin', 'Full access within this store', false, 'active'
  from target_store
  on conflict (store_id, name) do update set description = excluded.description
  returning id
)
insert into public.role_permissions (role_id, permission_id)
select new_role.id, permissions.id from new_role cross join public.permissions
on conflict (role_id, permission_id) do nothing;

-- -----------------------------------------------------------------------------
-- 5. One "admin" store user per store, with DIFFERENT passwords, to prove
--    STORE-0001/admin and STORE-0002/admin are fully independent accounts.
--    (Store codes are assigned in creation order by generate_store_code();
--    Demo Clothing Store -> STORE-0001, Fashion Hub -> STORE-0002 in a
--    fresh database.)
--
--    Demo Clothing Store / admin  -> password: DevPass123!  (LOCAL DEV ONLY)
--    Fashion Hub         / admin  -> password: DevPass456!  (LOCAL DEV ONLY)
-- -----------------------------------------------------------------------------
with target_store as (
  select id from public.stores where business_name = 'Demo Clothing Store' limit 1
),
target_role as (
  select id from public.roles where name = 'Store Admin'
    and store_id = (select id from target_store) limit 1
)
insert into public.store_users (store_id, login_id, password_hash, full_name, role_id, status)
select
  target_store.id,
  'admin',
  '$2b$12$.1Hun2nPwF6fHqH4h..li.kPdoUC.Sg/8F/XKaZgNZLduTYV5Mt2u',
  'Demo Store Admin',
  target_role.id,
  'active'
from target_store, target_role
on conflict (store_id, login_id) do nothing;

with target_store as (
  select id from public.stores where business_name = 'Fashion Hub' limit 1
),
target_role as (
  select id from public.roles where name = 'Store Admin'
    and store_id = (select id from target_store) limit 1
)
insert into public.store_users (store_id, login_id, password_hash, full_name, role_id, status)
select
  target_store.id,
  'admin',
  '$2b$12$u9XpTwjUMgZ03B0GP5V/4.uCkujYBbCpymFYY7apOrQVoz5k7iDle',
  'Fashion Hub Admin',
  target_role.id,
  'active'
from target_store, target_role
on conflict (store_id, login_id) do nothing;

commit;

-- =============================================================================
-- QUICK REFERENCE — LOCAL DEV LOGIN CREDENTIALS (do not use anywhere but a
-- local/throwaway Supabase project; rotate immediately if this ever touched
-- a shared database)
--
--   SaaS Admin:  loginId = dev_admin       password = DevAdmin123!
--   Store 1:     storeId = STORE-0001      loginId = admin   password = DevPass123!
--   Store 2:     storeId = STORE-0002      loginId = admin   password = DevPass456!
-- =============================================================================
