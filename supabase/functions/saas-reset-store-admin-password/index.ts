// SERVER-ONLY (Deno Edge Function runtime).
// POST /functions/v1/saas-reset-store-admin-password
// Body: { storeId: string, storeUserId: string, newPassword: string, confirmPassword: string }
//
// SaaS Admin only. Distinct from the store-scoped
// admin-reset-store-user-password function (that one is for a Store Admin
// resetting a teammate's password within their OWN session-derived store —
// this one is for a SaaS Admin acting across any store). The critical check
// here is still the same shape: the target user must actually belong to
// the storeId given, verified server-side, not assumed from the request.

import { supabaseAdmin } from '../_shared/db.ts';
import { hashPassword, isPasswordStrongEnough } from '../_shared/password.ts';
import { requireSaasAdminSession, authErrorResponse } from '../_shared/authMiddleware.ts';
import { handlePreflight } from '../_shared/cors.ts';
import { jsonResponse, isValidUuid } from '../_shared/saasHelpers.ts';
import { writeAuditLog } from '../_shared/audit.ts';
import { clientIp } from '../_shared/rateLimit.ts';

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  const origin = req.headers.get('origin');
  const ip = clientIp(req);

  if (req.method !== 'POST') {
    return jsonResponse(405, { code: 'METHOD_NOT_ALLOWED', message: 'Use POST.' }, origin);
  }

  let saasAdminId: string;
  try {
    const context = await requireSaasAdminSession(req);
    saasAdminId = context.saasAdminId;
  } catch (error) {
    const { status, body } = authErrorResponse(error);
    return jsonResponse(status, body, origin);
  }

  let payload: { storeId?: string; storeUserId?: string; newPassword?: string; confirmPassword?: string };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse(400, { code: 'BAD_REQUEST', message: 'Invalid request body.' }, origin);
  }

  if (!isValidUuid(payload.storeId) || !isValidUuid(payload.storeUserId)) {
    return jsonResponse(400, { code: 'BAD_REQUEST', message: 'A valid storeId and storeUserId are required.' }, origin);
  }
  if (!payload.newPassword || payload.newPassword !== payload.confirmPassword) {
    return jsonResponse(400, { code: 'PASSWORD_MISMATCH', message: 'New password and confirmation do not match.' }, origin);
  }
  if (!isPasswordStrongEnough(payload.newPassword)) {
    return jsonResponse(400, { code: 'PASSWORD_TOO_WEAK', message: 'New password must be at least 8 characters.' }, origin);
  }

  // Verify the target user actually belongs to the given store — never
  // trust the pairing implicitly.
  const { data: targetUser } = await supabaseAdmin
    .from('store_users')
    .select('id, store_id, login_id')
    .eq('id', payload.storeUserId)
    .eq('store_id', payload.storeId)
    .maybeSingle();

  if (!targetUser) {
    return jsonResponse(404, { code: 'USER_NOT_FOUND', message: 'User not found in the specified store.' }, origin);
  }

  const newHash = await hashPassword(payload.newPassword);

  await supabaseAdmin
    .from('store_users')
    .update({
      password_hash: newHash,
      password_changed_at: new Date().toISOString(),
      failed_login_attempts: 0,
      locked_until: null,
    })
    .eq('id', targetUser.id);

  await supabaseAdmin
    .from('store_user_sessions')
    .update({ revoked_at: new Date().toISOString() })
    .eq('store_user_id', targetUser.id)
    .is('revoked_at', null);

  await writeAuditLog({
    storeId: payload.storeId,
    saasAdminId,
    module: 'saas_store_management',
    action: 'store_admin_password_reset',
    entityType: 'store_user',
    entityId: targetUser.id,
    ipAddress: ip,
    metadata: { loginId: targetUser.login_id },
  });

  return jsonResponse(200, { success: true }, origin);
});
