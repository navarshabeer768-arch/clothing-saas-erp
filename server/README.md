# server/ — superseded by supabase/functions/

Phase 1 scaffolded this directory as a placeholder for "wherever the
trusted server layer ends up." Phase 2 decided that answer: **Supabase
Edge Functions**, implemented under `supabase/functions/`.

- Real password hashing: `supabase/functions/_shared/password.ts`
- Real session tokens: `supabase/functions/_shared/sessionTokens.ts`
- Real auth middleware: `supabase/functions/_shared/authMiddleware.ts`
- Real endpoints: `supabase/functions/store-login/`, `saas-login/`,
  `session-me/`, `logout/`, `logout-all/`, `change-password/`,
  `admin-reset-store-user-password/`
- Deployment instructions: `supabase/functions/DEPLOY.md`

This directory (`server/lib/passwordHashing.ts`, `server/lib/sessionTokens.ts`,
`server/functions/README.md`) is kept only as a historical record of the
Phase 1 planning — those files still throw "not implemented" if imported,
and nothing in the app imports them. They can be deleted in a future
cleanup pass; left in place for now per "don't destructively rewrite prior
phases without a strong reason."
