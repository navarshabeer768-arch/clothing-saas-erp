// SERVER-ONLY (Deno Edge Function runtime).
// POST /functions/v1/logout-all
//
// Revokes every active session belonging to the currently authenticated
// principal (store_user or saas_admin) — the foundation for a future
// "Logout all devices" UI action. No such UI is built in Phase 2; this
// endpoint exists so Phase 3+ can wire a button straight to it.

import { supabaseAdmin } from '../_shared/db.ts';
import { requireStoreSession, requireSaasAdminSession, authErrorResponse } from '../_shared/authMiddleware.ts';
import { clearStoreSessionCookie, clearSaasSessionCookie, readStoreSessionToken, readSaasSessionToken } from '../_shared/cookies.ts';
import { corsHeaders, handlePreflight } from '../_shared/cors.ts';
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

  if (readStoreSessionToken(req)) {
    try {
      const context = await requireStoreSession(req);
      const { count } = await supabaseAdmin
        .from('store_user_sessions')
        .update({ revoked_at: new Date().toISOString() })
        .eq('store_user_id', context.storeUserId)
        .is('revoked_at', null)
        .select('id', { count: 'exact', head: true });

      await writeAuditLog({
        storeId: context.storeId,
        storeUserId: context.storeUserId,
        module: 'auth',
        action: 'session_revoked',
        ipAddress: ip,
        metadata: { reason: 'logout_all', revokedCount: count ?? 0 },
      });

      return jsonResponse(200, { success: true, revokedCount: count ?? 0 }, origin, {
        'Set-Cookie': clearStoreSessionCookie(),
      });
    } catch (error) {
      const { status, body } = authErrorResponse(error);
      return jsonResponse(status, body, origin);
    }
  }

  if (readSaasSessionToken(req)) {
    try {
      const context = await requireSaasAdminSession(req);
      const { count } = await supabaseAdmin
        .from('saas_admin_sessions')
        .update({ revoked_at: new Date().toISOString() })
        .eq('saas_admin_id', context.saasAdminId)
        .is('revoked_at', null)
        .select('id', { count: 'exact', head: true });

      await writeAuditLog({
        saasAdminId: context.saasAdminId,
        module: 'saas_auth',
        action: 'session_revoked',
        ipAddress: ip,
        metadata: { reason: 'logout_all', revokedCount: count ?? 0 },
      });

      return jsonResponse(200, { success: true, revokedCount: count ?? 0 }, origin, {
        'Set-Cookie': clearSaasSessionCookie(),
      });
    } catch (error) {
      const { status, body } = authErrorResponse(error);
      return jsonResponse(status, body, origin);
    }
  }

  return jsonResponse(401, { code: 'NO_SESSION', message: 'Not authenticated.' }, origin);
});
