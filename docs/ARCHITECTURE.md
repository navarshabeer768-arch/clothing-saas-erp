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
| `0011_login_rate_limits.sql` | DB-backed login rate limiting (Phase 2) |
| `0012_saas_admin_lockout_fields.sql` | Adds lockout fields to `saas_admins` (Phase 2) |
| `0013_auth_helper_functions.sql` | Atomic rate-limit/lockout SQL functions (Phase 2) |
| `0014_store_management_functions.sql` | Atomic store creation + status-change transactions (Phase 3) |
| `0015_store_list_and_dashboard.sql` | Store search/pagination + SaaS dashboard summary RPCs (Phase 3) |

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

## 12. Phase 2 — Authentication & session implementation

Phase 2 implements the concrete auth system the earlier sections describe.
Summary of decisions (full detail in code comments at each referenced file):

- **Server runtime:** Supabase Edge Functions (`supabase/functions/`), not
  a separate Node server — keeps the service-role key inside Supabase's own
  secret store (`supabase secrets set`) and avoids standing up/hosting a
  second server for a static-only GitHub Pages frontend. See
  `supabase/functions/DEPLOY.md` for deployment steps (requires your own
  `supabase login`, which this environment cannot do on your behalf).
- **Password hashing:** bcrypt (cost factor 12) via `bcryptjs`, not
  Argon2id — Argon2's native bindings aren't reliable inside Deno's
  sandboxed Edge Function runtime. bcrypt is the explicitly-allowed
  fallback and has a mature pure-JS implementation. See
  `supabase/functions/_shared/password.ts`.
- **Session tokens:** opaque, `crypto.getRandomValues`-generated, SHA-256
  hashed before storage (`store_user_sessions.token_hash` /
  `saas_admin_sessions.token_hash`). Raw token never touches the database.
  See `supabase/functions/_shared/sessionTokens.ts`.
- **Session transport:** HttpOnly, Secure, `SameSite=None` cookies, set by
  the Edge Function response, read via `credentials: 'include'` fetches
  from the frontend. See `supabase/functions/_shared/cookies.ts` for the
  full rationale, including the known Safari third-party-cookie limitation
  that comes from the frontend (GitHub Pages) and backend (Supabase Edge
  Functions) being different origins, and the recommended durable fix
  (same-registrable-domain hosting once a custom domain is introduced).
- **Rate limiting:** DB-backed fixed-window counters
  (`login_rate_limits`, `increment_login_rate_limit()`) since Edge
  Functions are stateless between invocations — an in-memory counter
  wouldn't survive across requests. Scoped independently by IP and by
  account (`store_id+login_id` or SaaS `login_id`) so one dimension can't
  be used to dodge the other.
- **Account lockout:** `failed_login_attempts`/`locked_until` on both
  `store_users` and `saas_admins`, incremented atomically via
  `register_store_user_failed_login()` / `register_saas_admin_failed_login()`
  (single SQL statements, race-condition-safe under concurrent attempts).
  Default: lock for 15 minutes after 5 consecutive failures.
- **Auth middleware:** `requireStoreSession()` / `requireSaasAdminSession()`
  in `supabase/functions/_shared/authMiddleware.ts` are the ONLY place
  session tokens are resolved into a trusted `storeId`. Every current and
  future privileged endpoint must call these rather than re-implementing
  session lookup, and must use the `storeId` they return — never a
  client-supplied one.
- **Frontend auth state:** `src/features/auth/AuthContext.tsx` calls the
  `session-me` endpoint on every app load (never assumes auth from
  localStorage), exposes `principal`, `store`, `isAuthenticated`,
  `isLoading`, `logout()`, and `hasPermission()`.
- **Permission checks are two separate layers:** `PermissionGuard`
  (`src/features/auth/PermissionGuard.tsx`) hides UI for a nicer
  experience; `requirePermission()` in the Edge Function middleware is the
  actual enforcement. Every future endpoint must call the backend check —
  the frontend guard alone is never sufficient.

## 13. Phase 3 — SaaS Store Management

Adds the SaaS Super Admin's ability to create/manage tenants end-to-end.

- **Atomic store creation:** `create_store_with_admin()` (SQL function,
  `0014_store_management_functions.sql`) creates the store, its "Store
  Admin" role, permission assignments, the initial admin user, default
  settings, and an audit row — all inside one Postgres function call, so a
  raised exception rolls back everything. No store can ever end up without
  an admin, or an admin without a role. Password hashing happens in the
  Edge Function (`saas-create-store`) before calling this function —
  Postgres never hashes passwords itself, keeping one hashing code path.
- **Store status changes:** `set_store_status()` updates status, revokes
  every active `store_user_sessions` row for that store whenever it leaves
  `active`, and writes audit entries — atomically, so "suspended but old
  sessions still valid" can't happen as an inconsistent partial state.
- **Search/pagination:** `list_stores()` does search+filter+pagination+user
  counts in one query rather than fetching every store into JS.
- **Every `saas-*` Edge Function requires `requireSaasAdminSession()`** —
  verified directly in code, not just documented (see the endpoint files
  under `supabase/functions/saas-*/`). A store_user session can never reach
  these endpoints.
- **Update whitelist:** `saas-update-store` explicitly lists editable
  fields and writes only those columns — never a generic
  `update(stores).set(req.body)`. `store_code` is not in the whitelist and
  cannot be changed through this endpoint at all.
- **Two separate password-reset endpoints, deliberately:**
  `admin-reset-store-user-password` (Phase 2) is for a Store Admin
  resetting a teammate within their own session-derived store;
  `saas-reset-store-admin-password` (Phase 3) is for a SaaS Admin acting
  across any store. Both independently re-verify the target user actually
  belongs to the store in question before touching anything.
- **No impersonation ("Login as Store") was implemented** — Phase 3 spec
  explicitly said not to add this insecurely, and a properly audited
  version (special session type, visible impersonation indicator, exit
  path) is deferred to a future phase.

New migrations: `0014_store_management_functions.sql`,
`0015_store_list_and_dashboard.sql`.
