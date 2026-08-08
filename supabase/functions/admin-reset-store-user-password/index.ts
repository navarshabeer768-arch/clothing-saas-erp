// SERVER-ONLY (Deno Edge Function runtime).
// POST /functions/v1/admin-reset-store-user-password
// Body: { targetStoreUserId: string, newPassword: string }
//
// Foundation for future Store Admin -> "reset a teammate's password" UI
// (no UI built in Phase 2; Phase 3+ wires a button to this). Requires the
// "users.manage" permission and enforces the tenant boundary itself: the
// target user must belong to the SAME store_id as the caller's own
// session — that store_id comes only from requireStoreSession(), never
// from the request body, so a STORE-0001 admin can never reset a
// STORE-0002 user's password even if they craft a request with that
// user's id.

import { supabaseAdmin } from '../_shared/db.ts';
import { hashPassword, isPasswordStrongEnough } from '../_shared/password.ts';
import { requireStoreSession, requirePermission, authErrorResponse } from '../_shared/authMiddleware.ts';
import { corsHeaders, handlePreflight } from '../_shared/cors.ts';
import { writeAuditLog } from '../_shared/audit.ts';
import { clientIp } from '../_shared/rateLimit.ts';

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
  const ip = clientIp(req);

  if (req.method !== 'POST') {
    return jsonResponse(405, { code: 'METHOD_NOT_ALLOWED', message: 'Use POST.' }, origin);
  }

  let payload: { targetStoreUserId?: string; newPassword?: string };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse(400, { code: 'BAD_REQUEST', message: 'Invalid request body.' }, origin);
  }

  const { targetStoreUserId, newPassword } = payload;
  if (!targetStoreUserId || !newPassword) {
    return jsonResponse(400, { code: 'BAD_REQUEST', message: 'targetStoreUserId and newPassword are required.' }, origin);
  }
  if (!isPasswordStrongEnough(newPassword)) {
    return jsonResponse(400, { code: 'PASSWORD_TOO_WEAK', message: 'New password must be at least 8 characters.' }, origin);
  }

  try {
    const context = await requireStoreSession(req);
    requirePermission(context, 'users.manage');

    // CRITICAL TENANT CHECK: the target user must belong to context.storeId
    // (from the verified session), not any store_id the client might send.
    const { data: targetUser } = await supabaseAdmin
      .from('store_users')
      .select('id, store_id')
      .eq('id', targetStoreUserId)
      .eq('store_id', context.storeId)
      .maybeSingle();

    if (!targetUser) {
      // Same generic 404-ish response whether the user doesn't exist at all
      // or exists but belongs to a different store — never confirm that a
      // given user id belongs to another tenant.
      return jsonResponse(404, { code: 'USER_NOT_FOUND', message: 'User not found in this store.' }, origin);
    }

    const newHash = await hashPassword(newPassword);
    await supabaseAdmin
      .from('store_users')
      .update({
        password_hash: newHash,
        password_changed_at: new Date().toISOString(),
        failed_login_attempts: 0,
        locked_until: null,
      })
      .eq('id', targetUser.id);

    // Revoke all of the target user's existing sessions — a password reset
    // should invalidate any session that might have been established under
    // the old credentials.
    await supabaseAdmin
      .from('store_user_sessions')
      .update({ revoked_at: new Date().toISOString() })
      .eq('store_user_id', targetUser.id)
      .is('revoked_at', null);

    await writeAuditLog({
      storeId: context.storeId,
      storeUserId: context.storeUserId,
      module: 'auth',
      action: 'password_changed',
      entityType: 'store_user',
      entityId: targetUser.id,
      ipAddress: ip,
      metadata: { resetByAdmin: true },
    });

    return jsonResponse(200, { success: true }, origin);
  } catch (error) {
    const { status, body } = authErrorResponse(error);
    return jsonResponse(status, body, origin);
  }
});
