# Deploying the Phase 2 auth Edge Functions

These functions were written and syntax-validated in this environment, but
**not deployed** — deployment requires `supabase login` (an interactive
CLI auth step) which this environment cannot perform on your behalf. Run
the following from your own machine.

## 1. Install the Supabase CLI

```bash
npm install -g supabase
supabase login
```

## 2. Link this project

```bash
supabase link --project-ref yvxsyvgccxdvmgazvofm
```

## 3. Apply the database migrations (if not already applied)

```bash
supabase db push
```

This includes the Phase 2 migrations (`0011`-`0013`) and the Phase 3
migrations: `0014_store_management_functions.sql`,
`0015_store_list_and_dashboard.sql`.

## 4. Set function secrets

```bash
supabase secrets set SUPABASE_URL=https://yvxsyvgccxdvmgazvofm.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<your service role key>
supabase secrets set ALLOWED_ORIGINS=https://navarshabeer768-arch.github.io,http://localhost:5173
```

`SUPABASE_SERVICE_ROLE_KEY` must be set **only** this way — never as a repo
secret used in the frontend build (that would ship it to every browser).

## 5. Deploy the functions

```bash
supabase functions deploy store-login
supabase functions deploy saas-login
supabase functions deploy session-me
supabase functions deploy logout
supabase functions deploy logout-all
supabase functions deploy change-password
supabase functions deploy admin-reset-store-user-password
supabase functions deploy saas-list-stores
supabase functions deploy saas-get-store
supabase functions deploy saas-create-store
supabase functions deploy saas-update-store
supabase functions deploy saas-store-status
supabase functions deploy saas-reset-store-admin-password
supabase functions deploy saas-dashboard-summary
```

Or all at once:

```bash
supabase functions deploy
```

## 6. (Optional) Load dev seed data

```bash
supabase db execute -f supabase/seed/0001_dev_seed.sql
```

Gives you a working `dev_admin` SaaS admin and two test stores
(`STORE-0001`/`admin`, `STORE-0002`/`admin`) with real, working bcrypt
password hashes — see the file for the actual dev-only passwords.

## 7. Point the frontend at the deployed functions

`VITE_API_BASE_URL` should already be set to
`https://yvxsyvgccxdvmgazvofm.supabase.co/functions/v1` in `.env.local` and
in the `VITE_API_BASE_URL` GitHub Actions repo secret — no change needed
unless you're running functions locally with `supabase functions serve`,
in which case use `http://localhost:54321/functions/v1`.

## Testing locally before deploying

```bash
supabase functions serve
```

Then point `VITE_API_BASE_URL` at `http://localhost:54321/functions/v1`
in `.env.local` and run `npm run dev`.
