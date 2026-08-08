# Clothing Store SaaS ERP/POS — Phase 1: Foundation

A multi-tenant SaaS Clothing Store ERP/POS Progressive Web Application.
**This is the Phase 1 foundation**: database architecture, custom-auth data
model, tenant isolation strategy, and the base React/TypeScript/Tailwind
app shell. Business modules (Products, Inventory, POS, Sales, Purchases,
Customers, Suppliers, Accounting, Reports, Loyalty, Offers, Returns) are
intentionally **not** implemented yet — see `docs/ARCHITECTURE.md` §11 and
the placeholder routes in `src/App.tsx`.

## Stack

React 19 · TypeScript · Tailwind CSS v4 · React Router v7 · Supabase
PostgreSQL · Vite

## Quick start

```bash
cp .env.example .env.local   # .env.local is already pre-filled for this project
npm install
npm run dev
```

Build for production:

```bash
npm run build
```

## Project structure

```
src/
  components/     Design system (Button, Input, Dialog, Toast, ...) + ErrorBoundary
  layouts/        StoreAppLayout, SaasAdminLayout, PublicLayout
  pages/          store/, saas/, public/, errors/
  routes/         Route-guard placeholders (real auth checks land in Phase 2)
  lib/            supabaseClient (anon-key only), apiClient, errors, cn
  types/          Hand-written types mirroring the SQL schema
supabase/
  migrations/     Numbered, idempotent SQL migrations (source of truth for schema)
  seed/           Local-development-only seed data (never auto-applied)
server/
  lib/            Server-only interfaces (password hashing, session tokens) — Phase 2 implements these
  functions/      Documented contract for the Phase 2 login/session endpoints
docs/
  ARCHITECTURE.md Full write-up: SaaS hierarchy, auth strategy, tenant isolation, security model
```

## Why no Supabase Auth?

We use a fully custom login system (Store ID + Login ID + Password, with
per-store-scoped usernames) instead of Supabase Auth. Full rationale in
`docs/ARCHITECTURE.md` §3.

## Tenant isolation, in one paragraph

Every business table carries a `store_id`. Row Level Security is enabled on
every table with **no permissive policies for anon/authenticated** — the
browser's Supabase anon key cannot read or write tenant data under any
circumstance, no matter what the frontend does. All real reads/writes go
through a trusted server layer (`server/`, built out in Phase 2) that
derives `store_id` from a verified session token, never from client input.
Full detail in `docs/ARCHITECTURE.md` §7–8.

## Database migrations

See `docs/ARCHITECTURE.md` §9 for the full migration list and how to apply
them (`supabase db push`, or paste into the Supabase SQL Editor in order).

## Deployment

- **Frontend:** GitHub Pages, auto-deployed on every push to `main` via
  `.github/workflows/deploy.yml`.
  Live at: https://navarshabeer768-arch.github.io/clothing-saas-erp/
- **Backend (Phase 2):** GitHub Pages is static-only and can't run the
  `server/` layer — that needs Supabase Edge Functions (or another
  server/edge host). See `docs/ARCHITECTURE.md` §8.1.

## Status

Phase 1 (this phase): foundation only. See the completion report delivered
alongside this codebase for what was built, tested, and what Phase 2 needs
to know.
