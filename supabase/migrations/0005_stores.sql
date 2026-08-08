-- =============================================================================
-- Migration: 0005_stores.sql
-- Purpose  : The tenant table. Every store is one clothing-store business
--            using the SaaS platform. All future business tables hang off
--            store_id (see 0999_tenant_convention_notes.sql).
-- =============================================================================

create table if not exists public.stores (
  id                  uuid primary key default gen_random_uuid(),

  -- Human-readable identifier, e.g. STORE-0001. Generated server-side via
  -- generate_store_code(); never used as a primary/foreign key.
  store_code          text not null default public.generate_store_code(),

  business_name       text not null,
  legal_name          text,

  owner_name          text not null,
  mobile              text not null,
  whatsapp            text,
  email                citext,

  address_line_1      text not null,
  address_line_2      text,
  city                text,
  state               text,
  country             text not null,
  postal_code         text,

  currency_code       text not null default 'QAR',
  timezone            text not null default 'Asia/Qatar',
  tax_number          text,

  logo_url            text,

  -- Soft-deletion lifecycle. Stores are archived, never hard-deleted, so that
  -- historical business records (invoices, audit logs, etc.) remain valid.
  status              text not null default 'active'
                       check (status in ('active', 'suspended', 'inactive', 'archived')),

  created_by          uuid references public.saas_admins (id) on delete set null,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint stores_store_code_key unique (store_code),
  constraint stores_currency_code_len check (char_length(currency_code) = 3)
);

comment on table public.stores is
  'Tenant table. One row per clothing-store business on the SaaS platform.';
comment on column public.stores.store_code is
  'Human-readable ID (STORE-0001). Display/reference only — never a FK target.';
comment on column public.stores.status is
  'active | suspended | inactive | archived. Stores are archived, never hard-deleted.';

create index if not exists idx_stores_store_code on public.stores (store_code);
create index if not exists idx_stores_status on public.stores (status);

create trigger trg_stores_updated_at
  before update on public.stores
  for each row
  execute function public.set_updated_at();

alter table public.stores enable row level security;
-- No anon/authenticated policies: all reads/writes go through trusted
-- server-side endpoints that use the service role and enforce tenant
-- authorization from a validated session (see docs/ARCHITECTURE.md).
