-- =============================================================================
-- Migration: 0009_settings.sql
-- Purpose  : Key/value settings storage, clearly separated by scope so tenant
--            boundaries stay unambiguous. Store-level and platform-level
--            settings are never mixed in the same table.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- store_settings — per-store configuration (invoice format, receipt config,
-- tax preferences, loyalty settings, POS settings, etc. added in later phases)
-- -----------------------------------------------------------------------------
create table if not exists public.store_settings (
  id                  uuid primary key default gen_random_uuid(),

  store_id            uuid not null references public.stores (id) on delete cascade,

  setting_key         text not null,
  setting_value       jsonb not null default '{}'::jsonb,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint store_settings_store_key_key unique (store_id, setting_key)
);

comment on table public.store_settings is
  'Per-store key/value settings (JSONB). High-frequency critical settings may
   graduate to dedicated columns/tables in later phases.';

create index if not exists idx_store_settings_store_id on public.store_settings (store_id);

create trigger trg_store_settings_updated_at
  before update on public.store_settings
  for each row
  execute function public.set_updated_at();

alter table public.store_settings enable row level security;

-- -----------------------------------------------------------------------------
-- saas_settings — platform-level configuration only, never store data.
-- -----------------------------------------------------------------------------
create table if not exists public.saas_settings (
  id                  uuid primary key default gen_random_uuid(),

  setting_key         text not null,
  setting_value       jsonb not null default '{}'::jsonb,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint saas_settings_setting_key_key unique (setting_key)
);

comment on table public.saas_settings is
  'Platform-wide key/value settings (JSONB). Never store tenant-specific data here.';

create trigger trg_saas_settings_updated_at
  before update on public.saas_settings
  for each row
  execute function public.set_updated_at();

alter table public.saas_settings enable row level security;
