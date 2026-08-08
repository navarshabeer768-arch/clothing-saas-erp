# Architecture — Clothing Store SaaS ERP/POS (Phase 1)

## 1. SaaS hierarchy

```
SaaS Platform
  └── saas_admins            (platform operators — not tied to any store)
  └── Store / Tenant (stores)
        └── store_users      (belong to exactly one store)
        └── store data       (products, sales, inventory, ... in later phases)
```

Every store-specific table introduced in future phases (`products`,
`product_variants`, `customers`, `suppliers`, `sales`, `sale_items`,
`purchases`, `expenses`, `accounts`, `inventory`, `stock_movements`, ...)
**must** include a `store_id uuid not null references stores(id)` column.
That is the single tenant key used everywhere.

## 2. `store_id` vs Store Code

- `stores.id` (UUID) is the real primary key and the only thing used in
  foreign keys.
- `stores.store_code` (e.g. `STORE-0001`) is a human-readable label for
  display, support conversations, and login screens. It is never used as a
  foreign key target and is generated safely server-side (see §5).

## 3. Why we do not use Supabase Auth

The business requirement is a custom login flow: **Store ID + Login ID +
Password**, with per-store-scoped usernames (the same `login_id` can exist
in two different stores). Supabase Auth is built around a single global
users table keyed by email/UID, which doesn't map cleanly onto "username
unique per tenant" semantics, and would pull in a signup/session model we
don't want (magic links, email verification, `auth.uid()`-based RLS) for a
non-email-based, multi-store login. Building our own thin login/session
layer on top of plain Postgres tables gives full control over that
per-tenant uniqueness and over lockout/session behavior, while still
leaning on Postgres for real constraints and Supabase for hosting/storage.

## 4. Password hashing strategy

- Passwords are **never** stored in plain text, anywhere — not in the
  database, not in logs, not in `audit_logs.metadata`.
- `saas_admins.password_hash` and `store_users.password_hash` store a
  server-generated hash (Argon2id preferred, bcrypt acceptable), produced
  and verified exclusively by server-side code (`server/lib/passwordHashing.ts`).
- Hashing/verification never happens in the browser. The frontend only ever
  sends a plain-text password over HTTPS to the trusted server endpoint at
  login time; it never receives or compares hashes itself.

## 5. Store Code generation (concurrency-safe)

`generate_store_code()` (see `supabase/migrations/0004_store_code_sequence.sql`)
wraps a real Postgres `SEQUENCE` (`store_code_seq`). Sequences are
atomic/concurrency-safe by design in Postgres, so two simultaneous store
creations can never receive the same code — unlike a naive
`SELECT MAX(...) + 1` in application code, which is a classic race
condition. The `STORE-####` formatting is centralized in this one SQL
function so the prefix/padding scheme can change later without touching
application code.

## 6. Session strategy

Two dedicated tables — `store_user_sessions` and `saas_admin_sessions` —
rather than one polymorphic `user_sessions` table. See the full rationale
in `supabase/migrations/0008_sessions.sql`; in short: real foreign keys and
referential integrity are more valuable than a single shared table, and
saas_admin sessions are a materially different risk tier than store_user
sessions. A read-only union view (`v_all_sessions`) is provided for
cross-cutting tooling.

Only a hash of each session token is stored (`token_hash`). The raw token
is generated server-side, returned to the client once at login, and kept
only in memory/secure storage on the client. Verifying a session means
hashing the incoming bearer token and looking it up by `token_hash`.

## 7. Tenant isolation strategy

**The browser's `store_id` is never trusted for authorization.** Even
though `store_users.store_id` is visible to the client for display
purposes, every privileged server operation re-derives `store_id` from the
verified session row (`store_user_sessions.store_id`), not from any
parameter the client sends. This holds even if someone edits the URL,
localStorage, sessionStorage, or crafts a raw API request — the server
never reads `store_id` from client input for authorization decisions.

At the database layer, every tenant-scoped table has Row Level Security
**enabled with no permissive policies for `anon`/`authenticated`** —
default-deny. The `anon` key shipped to the browser (`VITE_SUPABASE_ANON_KEY`)
therefore cannot read or write tenant data directly under any circumstance,
regardless of frontend bugs. All reads/writes go through the trusted server
layer, which uses the service-role key (server-side only) and applies its
own `store_id` scoping logic derived from the session.

## 8. Client/server security model

```
Frontsend (React/TS, browser)
   │  fetches via src/lib/apiClient.ts (VITE_API_BASE_URL)
   ▼
Trusted server-side functions (server/)
   │  service-role Supabase client, password hashing, session issuance
   ▼
Supabase PostgreSQL (RLS default-deny for anon/authenticated)
```

- `SUPABASE_SERVICE_ROLE_KEY` lives only in the server runtime's
  environment (Supabase Edge Function secrets, or a separate server host's
  env vars). It is never present in `VITE_`-prefixed variables, never
  imported under `src/`, and never committed to git.
- Privileged operations (password verification, session issuance, store
  creation, store suspension, password reset, anything permission-sensitive)
  execute only in `server/`, never as a raw Supabase query from the browser.
- The browser's Supabase client (`src/lib/supabaseClient.ts`) uses only the
  anon key, has Supabase Auth's own session persistence disabled (we don't
  use Supabase Auth), and is safe to ship precisely because RLS blocks it
  from doing anything sensitive.

### 8.1 Hosting split: GitHub Pages (frontend) + a real server (Phase 2)

The frontend is deployed to **GitHub Pages**
(`https://navarshabeer768-arch.github.io/clothing-saas-erp/`), via
`.github/workflows/deploy.yml` on every push to `main`. GitHub Pages is
**static-file hosting only** — it cannot execute the `server/` layer
described above. This is fine and expected: the diagram's split into
"frontend" and "trusted server" was designed around exactly this
constraint from Phase 1.

Practical consequences:

- `SUPABASE_SERVICE_ROLE_KEY` must never be added as a GitHub Pages/Actions
  build-time (`VITE_...`) secret — anything with a `VITE_` prefix is
  compiled into the public JS bundle that ships to every visitor's browser.
  Only `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_API_BASE_URL`
  are set as repo secrets for the Pages build.
- Phase 2's server endpoints (`server/functions/README.md`) need to run
  somewhere that *can* execute code — Supabase Edge Functions is the
  natural fit here since the project already uses Supabase (the service
  role key stays inside Supabase's own secret store via
  `supabase secrets set`). A separate Node/Edge host works too.
- `VITE_API_BASE_URL` in the GitHub Pages build points at wherever that
  server ends up (e.g. `https://<project-ref>.functions.supabase.co`),
  configured as a repo secret, not hard-coded.
- Because GitHub Pages has no server-side rewrites, deep links
  (`/app/dashboard`) would 404 on a hard refresh. `public/404.html` +
  the restore script in `index.html` implement the standard
  [SPA-on-GitHub-Pages redirect trick](https://github.com/rafgraph/spa-github-pages)
  to work around this — this is a hosting-layer workaround, not a security
  boundary, and has no bearing on tenant isolation or RLS.

## 9. Database migrations

All schema lives in versioned, numbered SQL files under
`supabase/migrations/`, applied in order:

| File | Contents |
|---|---|
| `0001_extensions.sql` | `pgcrypto`, `citext` |
| `0002_helper_functions.sql` | `set_updated_at()` trigger function |
| `0003_saas_admins.sql` | Platform admins |
| `0004_store_code_sequence.sql` | Concurrency-safe store code generator |
| `0005_stores.sql` | Tenant table |
| `0006_roles_permissions.sql` | `roles`, `permissions`, `role_permissions` |
| `0007_store_users.sql` | Store-scoped users |
| `0008_sessions.sql` | `store_user_sessions`, `saas_admin_sessions`, `v_all_sessions` |
| `0009_settings.sql` | `store_settings`, `saas_settings` |
| `0010_audit_logs.sql` | Append-only audit trail |

Development-only seed data lives separately in `supabase/seed/` (excluded
from automatic migration runs — see that file's header for how to apply it
manually, and why its placeholder password hashes are not usable as-is).

### Running migrations

This project does not commit a linked Supabase CLI config (no DB password
was provided). To apply migrations against your Supabase project:

```bash
# Option A — Supabase CLI (recommended)
supabase link --project-ref yvxsyvgccxdvmgazvofm
supabase db push   # applies supabase/migrations/*.sql in order

# Option B — Supabase Dashboard → SQL Editor
# Paste each file from supabase/migrations/, in numeric order, and run it.
```

Every migration uses `create table if not exists` / `create index if not
exists` / `create or replace function`, so re-running them is safe and
idempotent.

## 10. Local development

```bash
cp .env.example .env.local   # already pre-filled with the provided anon key
npm install
npm run dev
```

`npm run build` runs `tsc -b && vite build` to typecheck and produce a
production bundle.

## 11. What Phase 2 builds on top of this

- Real implementations of `server/lib/passwordHashing.ts` and
  `server/lib/sessionTokens.ts`.
- The actual `/api/store/login`, `/api/saas/login`, `/api/session/me`
  endpoints described in `server/functions/README.md`.
- Wiring `ProtectedStoreRoute` / `ProtectedSaasRoute` to a real session
  check instead of the current pass-through placeholder.
- An auth context/hook (`src/hooks/useAuth.ts`, not yet created) exposing
  the resolved `StoreUserPrincipal`/`SaasAdminPrincipal` to the app.
