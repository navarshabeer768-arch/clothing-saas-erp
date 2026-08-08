import { createClient } from '@supabase/supabase-js';

/**
 * Browser-safe Supabase client.
 *
 * SECURITY: this client is initialized with the ANON/PUBLIC key only. It is
 * safe to ship in the frontend bundle because:
 *   1. Every Phase-1 table has Row Level Security enabled with no permissive
 *      policies for the anon/authenticated roles (default-deny).
 *   2. We are NOT using Supabase Auth, so this client is never used to sign
 *      users in/out — `auth.uid()` is not part of our security model.
 *
 * This client should only ever be used for things that are genuinely safe to
 * do with anonymous, RLS-restricted access (e.g. none yet in Phase 1 — most
 * reads/writes belong behind the trusted server API, see src/services/).
 *
 * The SUPABASE_SERVICE_ROLE_KEY must NEVER be imported here or anywhere
 * under src/. It only ever lives in the server-side environment described in
 * docs/ARCHITECTURE.md § Client/Server Separation.
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  // Fail loudly in development rather than silently creating a broken client.
  console.error(
    '[supabaseClient] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. ' +
      'Copy .env.example to .env.local and fill in your project values.'
  );
}

export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '', {
  auth: {
    // We do not use Supabase Auth at all — disable its client-side session
    // persistence so it never interferes with our custom auth system.
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});
