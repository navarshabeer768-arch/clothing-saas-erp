// SERVER-ONLY (Deno Edge Function runtime).
// POST /functions/v1/change-password
// Body: { currentPassword: string, newPassword: string, confirmPassword: string }
//
// Works for whichever principal is currently authenticated (store_user or
// saas_admin, resolved from the session cookie — never from a client-sent
// user id). Requires the current password, enforces a minimum length on
// the new one, and revokes all OTHER sessions on success so a stolen
// session token can't survive a password change.

import { supabaseAdmin } from '../_shared/db.ts';
import { hashPassword, verifyPassword, isPasswordStrongEnough } from '../_shared/password.ts';
import { requireStoreSession, requireSaasAdminSession, authErrorResponse } from '../_shared/authMiddleware.ts';
import { readStoreSessionToken, readSaasSessionToken } from '../_shared/cookies.ts';
import { corsHeaders, handlePreflight } from '../_shared/cors.ts';
import { writeAuditLog } from '../_shared/audit.ts';
import { clientIp } from '../_shared/rateLimit.ts';
import { hashToken } from '../_shared/sessionTokens.ts';

function jsonResponse(status: number, body: unknown, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

interface ChangePasswordPayload {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  const origin = req.headers.get('origin');
  const ip = clientIp(req);

  if (req.method !== 'POST') {
    return jsonResponse(405, { code: 'METHOD_NOT_ALLOWED', message: 'Use POST.' }, origin);
  }

  let payload: ChangePasswordPayload;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse(400, { code: 'BAD_REQUEST', message: 'Invalid request body.' }, origin);
  }

  const { currentPassword, newPassword, confirmPassword } = payload;
  if (!currentPassword || !newPassword || !confirmPassword) {
    return jsonResponse(400, { code: 'BAD_REQUEST', message: 'All fields are required.' }, origin);
  }
  if (newPassword !== confirmPassword) {
    return jsonResponse(400, { code: 'PASSWORD_MISMATCH', message: 'New password and confirmation do not match.' }, origin);
  }
  if (!isPasswordStrongEnough(newPassword)) {
    return jsonResponse(400, { code: 'PASSWORD_TOO_WEAK', message: 'New password must be at least 8 characters.' }, origin);
  }

  const isStoreUser = Boolean(readStoreSessionToken(req));
  const isSaasAdmin = Boolean(readSaasSessionToken(req));

  if (isStoreUser) {
    try {
      const context = await requireStoreSession(req);

      const { data: user } = await supabaseAdmin
        .from('store_users')
        .select('id, password_hash')
        .eq('id', context.storeUserId)
        .single();

      const currentValid = await verifyPassword(currentPassword, user.password_hash);
      if (!currentValid) {
        return jsonResponse(401, { code: 'INVALID_CURRENT_PASSWORD', message: 'Current password is incorrect.' }, origin);
      }

      const newHash = await hashPassword(newPassword);
      await supabaseAdmin
        .from('store_users')
        .update({ password_hash: newHash, password_changed_at: new Date().toISOString() })
        .eq('id', context.storeUserId);

      // Revoke every OTHER session for this user (keep the current one alive).
      const currentTokenHash = await hashToken(readStoreSessionToken(req)!);
      await supabaseAdmin
        .from('store_user_sessions')
        .update({ revoked_at: new Date().toISOString() })
        .eq('store_user_id', context.storeUserId)
        .neq('token_hash', currentTokenHash)
        .is('revoked_at', null);

      await writeAuditLog({
        storeId: context.storeId,
        storeUserId: context.storeUserId,
        module: 'auth',
        action: 'password_changed',
        ipAddress: ip,
      });

      return jsonResponse(200, { success: true }, origin);
    } catch (error) {
      const { status, body } = authErrorResponse(error);
      return jsonResponse(status, body, origin);
    }
  }

  if (isSaasAdmin) {
    try {
      const context = await requireSaasAdminSession(req);

      const { data: admin } = await supabaseAdmin
        .from('saas_admins')
        .select('id, password_hash')
        .eq('id', context.saasAdminId)
        .single();

      const currentValid = await verifyPassword(currentPassword, admin.password_hash);
      if (!currentValid) {
        return jsonResponse(401, { code: 'INVALID_CURRENT_PASSWORD', message: 'Current password is incorrect.' }, origin);
      }

      const newHash = await hashPassword(newPassword);
      await supabaseAdmin.from('saas_admins').update({ password_hash: newHash }).eq('id', context.saasAdminId);

      const currentTokenHash = await hashToken(readSaasSessionToken(req)!);
      await supabaseAdmin
        .from('saas_admin_sessions')
        .update({ revoked_at: new Date().toISOString() })
        .eq('saas_admin_id', context.saasAdminId)
        .neq('token_hash', currentTokenHash)
        .is('revoked_at', null);

      await writeAuditLog({
        saasAdminId: context.saasAdminId,
        module: 'saas_auth',
        action: 'password_changed',
        ipAddress: ip,
      });

      return jsonResponse(200, { success: true }, origin);
    } catch (error) {
      const { status, body } = authErrorResponse(error);
      return jsonResponse(status, body, origin);
    }
  }

  return jsonResponse(401, { code: 'NO_SESSION', message: 'Not authenticated.' }, origin);
});
