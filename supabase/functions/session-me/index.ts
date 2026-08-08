// SERVER-ONLY (Deno Edge Function runtime).
// GET /functions/v1/session-me
//
// Called on every app load/refresh instead of trusting any client-side
// cached auth state. Checks for a store_session cookie first, then a
// saas_session cookie, and returns whichever resolves to a valid session
// (or 401 if neither does). This is also where last_activity_at gets a
// throttled update.

import { requireStoreSession, requireSaasAdminSession, authErrorResponse, touchSessionActivity } from '../_shared/authMiddleware.ts';
import { corsHeaders, handlePreflight } from '../_shared/cors.ts';
import { readStoreSessionToken, readSaasSessionToken } from '../_shared/cookies.ts';

function jsonResponse(status: number, body: unknown, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  const origin = req.headers.get('origin');

  if (req.method !== 'GET') {
    return jsonResponse(405, { code: 'METHOD_NOT_ALLOWED', message: 'Use GET.' }, origin);
  }

  const hasStoreCookie = Boolean(readStoreSessionToken(req));
  const hasSaasCookie = Boolean(readSaasSessionToken(req));

  if (hasStoreCookie) {
    try {
      const context = await requireStoreSession(req);
      await touchSessionActivity('store_user_sessions', context.sessionId);
      return jsonResponse(
        200,
        {
          kind: 'store_user',
          user: {
            id: context.storeUserId,
            loginId: context.loginId,
            fullName: context.fullName,
            roleId: context.roleId,
            permissions: context.permissions,
          },
          store: {
            id: context.storeId,
            storeCode: context.storeCode,
            businessName: context.storeName,
          },
        },
        origin
      );
    } catch (error) {
      const { status, body } = authErrorResponse(error);
      return jsonResponse(status, body, origin);
    }
  }

  if (hasSaasCookie) {
    try {
      const context = await requireSaasAdminSession(req);
      await touchSessionActivity('saas_admin_sessions', context.sessionId);
      return jsonResponse(
        200,
        {
          kind: 'saas_admin',
          admin: { id: context.saasAdminId, loginId: context.loginId, fullName: context.fullName },
        },
        origin
      );
    } catch (error) {
      const { status, body } = authErrorResponse(error);
      return jsonResponse(status, body, origin);
    }
  }

  return jsonResponse(401, { code: 'NO_SESSION', message: 'Not authenticated.' }, origin);
});
