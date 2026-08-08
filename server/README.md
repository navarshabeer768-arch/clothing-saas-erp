# Server (trusted, privileged operations)

This directory is scaffolding for Phase 2+. Nothing here runs yet — it exists
so the client/server boundary is established from day one instead of being
retrofitted later.

## Why this exists

The frontend (`src/`) never talks to Supabase with the service-role key, and
never verifies passwords itself. Anything privileged goes through this
server layer, which is the **only** place allowed to:

- hold `SUPABASE_SERVICE_ROLE_KEY`
- hash and verify passwords
- issue and verify session tokens
- resolve `store_id` from a verified session (never from client input)
- write to `audit_logs`, `saas_admins`, `store_users`, etc.

## Layout

```
server/
  functions/    Individual endpoint handlers (login, session, store creation, ...)
  lib/          Shared server-only helpers (password hashing, session tokens)
```

## Deployment target (decide in Phase 2)

Any of the following satisfy the "trusted server-side" requirement — pick
whichever fits the rest of the stack:

- Supabase Edge Functions (Deno) — keeps everything inside the Supabase
  project, easiest to keep the service-role key co-located and secret.
- A small Node/Express or Hono server deployed separately, calling Supabase
  with the service-role key from its own server environment.

Whichever is chosen, the contract is the same: `src/lib/apiClient.ts` calls
`VITE_API_BASE_URL + /api/...`, and this directory implements those routes.

## Phase 1 status

Only placeholder files exist (`functions/README.md`,
`lib/passwordHashing.ts`, `lib/sessionTokens.ts`) documenting the intended
interface. Real implementations, and the actual login/session endpoints,
are built in Phase 2.
