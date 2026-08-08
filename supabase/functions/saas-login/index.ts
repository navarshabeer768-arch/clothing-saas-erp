// SERVER-ONLY (Deno Edge Function runtime).
// POST /functions/v1/saas-login
// Body: { loginId: string, password: string }
//
// Mirrors store-login's flow, but scoped to saas_admins (no store_id
// involved at all) and writes to the separate saas_admin_sessions table —
// SaaS admin sessions are never mixed with store_user sessions.

import { supabaseAdmin } from '../_shared/db.ts';
import { verifyPassword } from '../_shared/password.ts';
import { generateSessionToken, hashToken } from '../_shared/sessionTokens.ts';
import { setSaasSessionCookie, SESSION_TTL } from '../_shared/cookies.ts';
import { corsHeaders, handlePreflight } from '../_shared/cors.ts';
import { checkAndIncrementRateLimit, clientIp } from '../_shared/rateLimit.ts';
import { writeAuditLog } from '../_shared/audit.ts';

const GENERIC_INVALID_MESSAGE = 'Invalid Login ID or password.';
const LOCK_THRESHOLD = 5;
const LOCK_MINUTES = 15;

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

  let payload: { loginId?: string; password?: string };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse(400, { code: 'BAD_REQUEST', message: 'Invalid request body.' }, origin);
  }

  const loginId = typeof payload.loginId === 'string' ? payload.loginId.trim() : '';
  const password = typeof payload.password === 'string' ? payload.password : '';

  if (!loginId || !password) {
    return jsonResponse(400, { code: 'BAD_REQUEST', message: GENERIC_INVALID_MESSAGE }, origin);
  }

  const ipBlocked = await checkAndIncrementRateLimit('ip', ip);
  const accountBlocked = await checkAndIncrementRateLimit('saas_login', loginId.toLowerCase());
  if (ipBlocked || accountBlocked) {
    return jsonResponse(429, { code: 'RATE_LIMITED', message: 'Too many login attempts. Please try again later.' }, origin);
  }

  const { data: admin } = await supabaseAdmin
    .from('saas_admins')
    .select('id, login_id, password_hash, full_name, status, failed_login_attempts, locked_until')
    .eq('login_id', loginId)
    .maybeSingle();

  if (!admin) {
    await writeAuditLog({ module: 'saas_auth', action: 'login_failed', ipAddress: ip, metadata: { reason: 'admin_not_found' } });
    return jsonResponse(401, { code: 'INVALID_LOGIN', message: GENERIC_INVALID_MESSAGE }, origin);
  }

  if (admin.status !== 'active') {
    await writeAuditLog({ saasAdminId: admin.id, module: 'saas_auth', action: 'login_failed', ipAddress: ip, metadata: { reason: 'admin_disabled' } });
    return jsonResponse(403, { code: 'USER_DISABLED', message: 'This admin account has been disabled.' }, origin);
  }

  const isLocked = admin.locked_until && new Date(admin.locked_until).getTime() > Date.now();
  if (isLocked) {
    await writeAuditLog({ saasAdminId: admin.id, module: 'saas_auth', action: 'login_failed', ipAddress: ip, metadata: { reason: 'admin_locked' } });
    return jsonResponse(403, { code: 'USER_LOCKED', message: 'Too many failed login attempts. Please try again later.' }, origin);
  }

  const passwordValid = await verifyPassword(password, admin.password_hash);
  if (!passwordValid) {
    const { data: lockResult } = await supabaseAdmin.rpc('register_saas_admin_failed_login', {
      p_saas_admin_id: admin.id,
      p_lock_threshold: LOCK_THRESHOLD,
      p_lock_minutes: LOCK_MINUTES,
    });
    const nowLocked = Array.isArray(lockResult) ? lockResult[0]?.locked_until : lockResult?.locked_until;

    await writeAuditLog({
      saasAdminId: admin.id,
      module: 'saas_auth',
      action: nowLocked ? 'account_locked' : 'login_failed',
      ipAddress: ip,
      metadata: { reason: 'wrong_password' },
    });

    return jsonResponse(
      nowLocked ? 403 : 401,
      {
        code: nowLocked ? 'USER_LOCKED' : 'INVALID_LOGIN',
        message: nowLocked ? 'Too many failed login attempts. Please try again later.' : GENERIC_INVALID_MESSAGE,
      },
      origin
    );
  }

  const rawToken = generateSessionToken();
  const tokenHash = await hashToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_TTL.saas * 1000).toISOString();
  const userAgent = req.headers.get('user-agent');

  const { data: session, error: sessionError } = await supabaseAdmin
    .from('saas_admin_sessions')
    .insert({ saas_admin_id: admin.id, token_hash: tokenHash, expires_at: expiresAt, ip_address: ip, user_agent: userAgent })
    .select('id')
    .single();

  if (sessionError || !session) {
    return jsonResponse(500, { code: 'INTERNAL_ERROR', message: 'Could not start a session. Please try again.' }, origin);
  }

  await supabaseAdmin.rpc('reset_saas_admin_login_state', { p_saas_admin_id: admin.id });

  await writeAuditLog({
    saasAdminId: admin.id,
    module: 'saas_auth',
    action: 'login_success',
    ipAddress: ip,
    metadata: { sessionId: session.id },
  });

  return jsonResponse(
    200,
    {
      admin: { id: admin.id, loginId: admin.login_id, fullName: admin.full_name },
      expiresAt,
    },
    origin,
    { 'Set-Cookie': setSaasSessionCookie(rawToken) }
  );
});
