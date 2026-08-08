-- =============================================================================
-- Migration: 0006_roles_permissions.sql
-- Purpose  : Role-based access control foundation.
--            - roles: either a system role (store_id is null) reusable across
--              all stores as a template, or a store-specific role.
--            - permissions: the fixed catalogue of fine-grained capabilities.
--            - role_permissions: join table assigning permissions to roles.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- roles
-- -----------------------------------------------------------------------------
create table if not exists public.roles (
  id                  uuid primary key default gen_random_uuid(),

  -- NULL store_id => system/template role (e.g. a default "Store Admin"
  -- template maintained by the SaaS platform). Non-null => a role that
  -- belongs to, and is only usable within, that specific store.
  store_id            uuid references public.stores (id) on delete cascade,

  name                text not null,
  description         text,

  is_system_role      boolean not null default false,

  status              text not null default 'active'
                       check (status in ('active', 'disabled')),

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  -- A role name must be unique within its scope (per store, or among the
  -- global system roles when store_id is null).
  constraint roles_store_name_key unique (store_id, name)
);

comment on table public.roles is
  'RBAC roles. store_id NULL = platform/system template role. store_id set = store-owned role.';

create index if not exists idx_roles_store_id on public.roles (store_id);
create index if not exists idx_roles_status on public.roles (status);

create trigger trg_roles_updated_at
  before update on public.roles
  for each row
  execute function public.set_updated_at();

alter table public.roles enable row level security;

-- -----------------------------------------------------------------------------
-- permissions
-- -----------------------------------------------------------------------------
create table if not exists public.permissions (
  id                  uuid primary key default gen_random_uuid(),

  -- e.g. 'sales.create'
  permission_key      text not null,
  module              text not null,
  action               text not null,
  description         text,

  created_at          timestamptz not null default now(),

  constraint permissions_permission_key_key unique (permission_key)
);

comment on table public.permissions is
  'Fixed catalogue of fine-grained permission keys, e.g. sales.create, inventory.adjust.';

create index if not exists idx_permissions_module on public.permissions (module);

alter table public.permissions enable row level security;

-- -----------------------------------------------------------------------------
-- role_permissions
-- -----------------------------------------------------------------------------
create table if not exists public.role_permissions (
  id                  uuid primary key default gen_random_uuid(),

  role_id             uuid not null references public.roles (id) on delete cascade,
  permission_id       uuid not null references public.permissions (id) on delete cascade,

  created_at          timestamptz not null default now(),

  constraint role_permissions_role_permission_key unique (role_id, permission_id)
);

comment on table public.role_permissions is
  'Join table: which permissions are granted to which role.';

create index if not exists idx_role_permissions_role_id on public.role_permissions (role_id);
create index if not exists idx_role_permissions_permission_id on public.role_permissions (permission_id);

alter table public.role_permissions enable row level security;
