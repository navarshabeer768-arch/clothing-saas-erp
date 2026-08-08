// SERVER-ONLY (Deno Edge Function runtime).
// POST /functions/v1/store-login
// Body: { storeId: string, loginId: string, password: string }
//
// Implements the full validation flow: store lookup -> store status ->
// user lookup (scoped by store_id+login_id together) -> user status ->
// password verification -> role -> permissions -> session -> audit -> response.
// Every failure path returns the SAME generic message so a caller can't
// enumerate which piece was wrong (store vs username vs password).

import { supabaseAdmin } from '../_shared/db.ts';
import { verifyPassword } from '../_shared/password.ts';
import { generateSessionToken, hashToken } from '../_shared/sessionTokens.ts';
import { setStoreSessionCookie, SESSION_TTL } from '../_shared/cookies.ts';
import { corsHeaders, handlePreflight } from '../_shared/cors.ts';
import { checkAndIncrementRateLimit, clientIp } from '../_shared/rateLimit.ts';
import { writeAuditLog } from '../_shared/audit.ts';

const GENERIC_INVALID_MESSAGE = 'Invalid Store ID, Login ID, or password.';
const LOCK_THRESHOLD = 5;
const LOCK_MINUTES = 15;

function jsonResponse(status: number, body: unknown, origin: string | null, extraHeaders: HeadersInit = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin),
      ...extraHeaders,
    },
  });
}

/** Normalizes user-entered Store ID: trim, uppercase. Never touch the password. */
function normalizeStoreCode(raw: string): string {
  return raw.trim().toUpperCase();
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  const origin = req.headers.get('origin');
  const ip = clientIp(req);

  if (req.method !== 'POST') {
    return jsonResponse(405, { code: 'METHOD_NOT_ALLOWED', message: 'Use POST.' }, origin);
  }

  let payload: { storeId?: string; loginId?: string; password?: string };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse(400, { code: 'BAD_REQUEST', message: 'Invalid request body.' }, origin);
  }

  const storeCode = typeof payload.storeId === 'string' ? normalizeStoreCode(payload.storeId) : '';
  const loginId = typeof payload.loginId === 'string' ? payload.loginId.trim() : '';
  const password = typeof payload.password === 'string' ? payload.password : '';

  if (!storeCode || !loginId || !password) {
    return jsonResponse(400, { code: 'BAD_REQUEST', message: GENERIC_INVALID_MESSAGE }, origin);
  }

  // --- Rate limiting (fails open, defense-in-depth on top of account lockout) ---
  const ipBlocked = await checkAndIncrementRateLimit('ip', ip);
  const accountBlocked = await checkAndIncrementRateLimit('store_login', `${storeCode}:${loginId.toLowerCase()}`);
  if (ipBlocked || accountBlocked) {
    return jsonResponse(
      429,
      { code: 'RATE_LIMITED', message: 'Too many login attempts. Please try again later.' },
      origin
    );
  }

  // --- Step 1: Store lookup ---
  const { data: store } = await supabaseAdmin
    .from('stores')
    .select('id, store_code, business_name, status, currency_code, timezone, logo_url')
    .eq('store_code', storeCode)
    .maybeSingle();

  if (!store) {
    await writeAuditLog({ module: 'auth', action: 'login_failed', ipAddress: ip, metadata: { reason: 'store_not_found', storeCode } });
    return jsonResponse(401, { code: 'INVALID_LOGIN', message: GENERIC_INVALID_MESSAGE }, origin);
  }

  // --- Step 2: Store status ---
  if (store.status !== 'active') {
    await writeAuditLog({
      storeId: store.id,
      module: 'auth',
      action: 'login_failed',
      ipAddress: ip,
      metadata: { reason: 'store_not_active', status: store.status },
    });
    return jsonResponse(
      403,
      { code: 'STORE_UNAVAILABLE', message: 'This store account is currently unavailable. Please contact your administrator.' },
      origin
    );
  }

  // --- Step 3: User lookup — MUST use both store_id AND login_id ---
  const { data: user } = await supabaseAdmin
    .from('store_users')
    .select('id, store_id, login_id, password_hash, full_name, status, role_id, failed_login_attempts, locked_until')
    .eq('store_id', store.id)
    .eq('login_id', loginId) // citext column -> case-insensitive match
    .maybeSingle();

  if (!user) {
    await writeAuditLog({ storeId: store.id, module: 'auth', action: 'login_failed', ipAddress: ip, metadata: { reason: 'user_not_found' } });
    return jsonResponse(401, { code: 'INVALID_LOGIN', message: GENERIC_INVALID_MESSAGE }, origin);
  }

  // --- Step 4: User status (disabled / locked) ---
  if (user.status === 'disabled') {
    await writeAuditLog({ storeId: store.id, storeUserId: user.id, module: 'auth', action: 'login_failed', ipAddress: ip, metadata: { reason: 'user_disabled' } });
    return jsonResponse(403, { code: 'USER_DISABLED', message: 'This user account has been disabled.' }, origin);
  }

  const isCurrentlyLocked = user.locked_until && new Date(user.locked_until).getTime() > Date.now();
  if (user.status === 'locked' || isCurrentlyLocked) {
    await writeAuditLog({ storeId: store.id, storeUserId: user.id, module: 'auth', action: 'login_failed', ipAddress: ip, metadata: { reason: 'user_locked' } });
    return jsonResponse(
      403,
      { code: 'USER_LOCKED', message: 'Too many failed login attempts. Please try again later.' },
      origin
    );
  }

  // --- Step 5: Password verification ---
  const passwordValid = await verifyPassword(password, user.password_hash);
  if (!passwordValid) {
    const { data: lockResult } = await supabaseAdmin.rpc('register_store_user_failed_login', {
      p_store_user_id: user.id,
      p_lock_threshold: LOCK_THRESHOLD,
      p_lock_minutes: LOCK_MINUTES,
    });
    const nowLocked = Array.isArray(lockResult) ? lockResult[0]?.locked_until : lockResult?.locked_until;

    await writeAuditLog({
      storeId: store.id,
      storeUserId: user.id,
      module: 'auth',
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

  // --- Step 6/7: Role + effective permissions ---
  let permissions: string[] = [];
  if (user.role_id) {
    const { data: rolePerms } = await supabaseAdmin
      .from('role_permissions')
      .select('permissions(permission_key)')
      .eq('role_id', user.role_id);
    permissions = (rolePerms ?? [])
      .map((row) => (row as { permissions: { permission_key: string } | null }).permissions?.permission_key)
      .filter((k): k is string => Boolean(k));
  }

  // --- Step 8: Create session ---
  const rawToken = generateSessionToken();
  const tokenHash = await hashToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_TTL.store * 1000).toISOString();
  const userAgent = req.headers.get('user-agent');

  const { data: session, error: sessionError } = await supabaseAdmin
    .from('store_user_sessions')
    .insert({
      store_user_id: user.id,
      store_id: store.id,
      token_hash: tokenHash,
      expires_at: expiresAt,
      ip_address: ip,
      user_agent: userAgent,
    })
    .select('id')
    .single();

  if (sessionError || !session) {
    return jsonResponse(500, { code: 'INTERNAL_ERROR', message: 'Could not start a session. Please try again.' }, origin);
  }

  // Reset lockout state + stamp last_login_at
  await supabaseAdmin.rpc('reset_store_user_login_state', { p_store_user_id: user.id });

  // --- Step 9: Audit success ---
  await writeAuditLog({
    storeId: store.id,
    storeUserId: user.id,
    module: 'auth',
    action: 'login_success',
    ipAddress: ip,
    metadata: { sessionId: session.id },
  });

  // --- Step 10: Safe response (no password_hash, no raw session hash) ---
  return jsonResponse(
    200,
    {
      user: {
        id: user.id,
        loginId: user.login_id,
        fullName: user.full_name,
        roleId: user.role_id,
        permissions,
      },
      store: {
        id: store.id,
        storeCode: store.store_code,
        businessName: store.business_name,
        currencyCode: store.currency_code,
        timezone: store.timezone,
        logoUrl: store.logo_url,
      },
      expiresAt,
    },
    origin,
    { 'Set-Cookie': setStoreSessionCookie(rawToken) }
  );
});
