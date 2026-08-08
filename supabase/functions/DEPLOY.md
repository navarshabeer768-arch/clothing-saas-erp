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

This includes the Phase 2 migrations (`0011`-`0013`), the Phase 3
migrations (`0014`-`0015`), and the Phase 4 migrations: `0016_subscription_plans.sql`,
`0017_store_subscriptions.sql`, `0018_subscription_functions.sql`,
`0019_subscription_list_and_dashboard.sql`.

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
supabase functions deploy saas-list-plans
supabase functions deploy saas-create-plan
supabase functions deploy saas-update-plan
supabase functions deploy saas-plan-status
supabase functions deploy saas-list-subscriptions
supabase functions deploy saas-get-store-subscription
supabase functions deploy saas-change-store-plan
supabase functions deploy saas-renew-subscription
supabase functions deploy saas-extend-subscription
supabase functions deploy saas-subscription-status
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

## Post-deploy verification checklist (run this yourself)

This exact checklist could not be run from the environment that built this
code — it has no network route to any `*.supabase.co`/`supabase.com`
domain and no Supabase account access token. Run through this after `supabase
db push` + `supabase functions deploy` complete successfully:

1. **SaaS Admin auth**: log in at `/saas/login`, refresh the page (session
   should persist), log out (should redirect to login, and a re-visit to
   `/saas/dashboard` should bounce back to login).
2. **Store creation**: as SaaS Admin, create a store via `/saas/stores/new`
   (leave Plan as "Start with Trial"). Confirm in the Supabase dashboard
   Table Editor that `stores`, `store_users`, `roles`, `role_permissions`,
   `store_settings`, `store_subscriptions`, `subscription_history`, and
   `audit_logs` all got a new row from one submit.
3. **Store login**: log out of SaaS Admin, go to `/login`, sign in with the
   new Store Code + `admin` + the password you set. Confirm you land on
   `/app/dashboard` showing the right store/name/role.
4. **Multi-tenant isolation**: create a second store, also with login id
   `admin` but a different password. Confirm `STORE-0001/admin` and
   `STORE-0002/admin` are independent — each password only works for its
   own store.
5. **Suspend/reactivate**: from SaaS Admin, suspend one test store. Confirm
   that store's login now fails with "This store account is currently
   unavailable...", then reactivate and confirm login works again.
6. **Archive**: archive the other test store, confirm login is blocked but
   the store still appears under the Archived filter in `/saas/stores`.
7. **Password reset**: from the store's details page, reset its Store
   Admin's password. Confirm the old password no longer works and the new
   one does.
8. **Subscription flows**: on a store's details page, try Change Plan,
   Renew, and Extend — confirm `store_subscriptions` updates in place and
   `subscription_history` gets a new row each time.
9. **Expiry enforcement**: manually set a test store's
   `store_subscriptions.current_period_end` to a past date via the SQL
   editor, then log in as that store's user — you should be redirected to
   `/subscription-expired` instead of the dashboard.
10. **Security**: while logged in as a store_user, try opening
    `/saas/stores` directly — it should redirect to `/saas/login`, not show
    data. Try calling a `saas-*` endpoint's URL directly with the store
    session cookie — it should return 401.

If any of these fail, fix it before building further modules on top —
don't layer new features over a foundation that isn't verified working.
