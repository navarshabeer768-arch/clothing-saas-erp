// SERVER-ONLY (Deno Edge Function runtime). Never imported from src/.
//
// This is the only place SUPABASE_SERVICE_ROLE_KEY is read. It comes from
// the function's own environment (set via `supabase secrets set`), never
// from a client request, never from a VITE_-prefixed variable. This client
// bypasses Row Level Security by design — every query built on top of it
// MUST manually scope by the store_id resolved from a verified session
// (see authMiddleware.ts), never from client-supplied input.

import { createClient } from 'npm:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the function environment. ' +
      'Set them with `supabase secrets set`.'
  );
}

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    // We don't use Supabase Auth — no session persistence needed here.
    persistSession: false,
    autoRefreshToken: false,
  },
});
