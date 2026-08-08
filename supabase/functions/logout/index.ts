// SERVER-ONLY (Deno Edge Function runtime).
// POST /functions/v1/logout
//
// Revokes the current session server-side (not just "forget the cookie
// client-side"). Works for either session type, whichever cookie is
// present.

import { supabaseAdmin } from '../_shared/db.ts';
import { hashToken } from '../_shared/sessionTokens.ts';
import { clearStoreSessionCookie, clearSaasSessionCookie } from '../_shared/cookies.ts';
import { corsHeaders, handlePreflight } from '../_shared/cors.ts';
import { readStoreSessionToken, readSaasSessionToken } from '../_shared/cookies.ts';
import { writeAuditLog } from '../_shared/audit.ts';
import { clientIp } from '../_shared/rateLimit.ts';

function jsonResponse(status: number, body: unknown, origin: string | null, extraHeaders: HeadersInit = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin), ...extraHeaders },
  });
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  const origin = req.headers.get('origin');
  const ip = clientIp(req);

  if (req.method !== 'POST') {
    return jsonResponse(405, { code: 'METHOD_NOT_ALLOWED', message: 'Use POST.' }, origin);
  }

  const storeToken = readStoreSessionToken(req);
  const saasToken = readSaasSessionToken(req);
  const clearHeaders: string[] = [];

  if (storeToken) {
    const tokenHash = await hashToken(storeToken);
    const { data: session } = await supabaseAdmin
      .from('store_user_sessions')
      .update({ revoked_at: new Date().toISOString() })
      .eq('token_hash', tokenHash)
      .is('revoked_at', null)
      .select('id, store_user_id, store_id')
      .maybeSingle();

    if (session) {
      await writeAuditLog({
        storeId: session.store_id,
        storeUserId: session.store_user_id,
        module: 'auth',
        action: 'logout',
        ipAddress: ip,
        metadata: { sessionId: session.id },
      });
    }
    clearHeaders.push(clearStoreSessionCookie());
  }

  if (saasToken) {
    const tokenHash = await hashToken(saasToken);
    const { data: session } = await supabaseAdmin
      .from('saas_admin_sessions')
      .update({ revoked_at: new Date().toISOString() })
      .eq('token_hash', tokenHash)
      .is('revoked_at', null)
      .select('id, saas_admin_id')
      .maybeSingle();

    if (session) {
      await writeAuditLog({
        saasAdminId: session.saas_admin_id,
        module: 'saas_auth',
        action: 'logout',
        ipAddress: ip,
        metadata: { sessionId: session.id },
      });
    }
    clearHeaders.push(clearSaasSessionCookie());
  }

  const headers = new Headers({ 'Content-Type': 'application/json', ...corsHeaders(origin) });
  for (const cookie of clearHeaders) headers.append('Set-Cookie', cookie);

  return new Response(JSON.stringify({ success: true }), { status: 200, headers });
});
