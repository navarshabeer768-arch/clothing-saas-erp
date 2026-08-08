# Server functions (Phase 2 targets)

No endpoints are implemented yet. This file documents the contract Phase 2
will fill in, so `src/lib/apiClient.ts` and the login pages already know
what shape to expect.

## Planned endpoints

| Method | Path                          | Purpose                                              |
|--------|-------------------------------|-------------------------------------------------------|
| POST   | `/api/store/login`            | Store ID + Login ID + Password → session token        |
| POST   | `/api/saas/login`              | SaaS admin Login ID + Password → session token         |
| POST   | `/api/store/logout`            | Revoke current store_user session                      |
| POST   | `/api/saas/logout`             | Revoke current saas_admin session                       |
| GET    | `/api/session/me`              | Resolve current principal from bearer token            |
| POST   | `/api/saas/stores`             | Create a store (Phase 3): store + Store Admin role + user, atomically |

## Shared behavior every endpoint must follow

1. Never trust a `store_id` supplied in the request body/query for
   authorization — only the `store_id` embedded in a verified session row.
2. Hash passwords with `server/lib/passwordHashing.ts` — never compare
   plain text, never log plain text.
3. Write an `audit_logs` row for security-relevant events (`login_success`,
   `login_failed`, `store_created`, etc).
4. Return generic error messages to the client (no stack traces, no SQL
   errors, no "user not found" vs "wrong password" distinction for login).
5. Use the Supabase service-role key only from this server environment,
   never forwarded to or readable by the browser.
