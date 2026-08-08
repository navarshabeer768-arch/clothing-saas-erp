// SERVER-ONLY (Deno Edge Function runtime). Never imported from src/.
//
// THE CENTRAL SECURITY INVARIANT OF THIS FILE:
// store_id used for any authorization decision comes ONLY from the
// database row matched by the session's token_hash — never from a request
// body field, query parameter, header, or anything else the client sends.
// Every future protected endpoint (Phase 3+) should call requireStoreSession()
// and use the returned `storeId`, and must never accept a client-supplied
// store_id as an override.

import { supabaseAdmin } from './db.ts';
import { hashToken } from './sessionTokens.ts';
import { readStoreSessionToken, readSaasSessionToken } from './cookies.ts';

export class AuthError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export interface SubscriptionSummary {
  status: string;
  effectiveStatus: string;
  planCode: string;
  planName: string;
  currentPeriodEnd: string;
  daysRemaining: number;
}

export interface StoreSessionContext {
  kind: 'store_user';
  sessionId: string;
  storeUserId: string;
  storeId: string;
  storeCode: string;
  storeStatus: string;
  storeName: string;
  loginId: string;
  fullName: string;
  roleId: string | null;
  permissions: string[];
  subscription: SubscriptionSummary | null;
}

export interface SaasSessionContext {
  kind: 'saas_admin';
  sessionId: string;
  saasAdminId: string;
  loginId: string;
  fullName: string;
}

/**
 * Resolves the authenticated store_user from the session cookie. Throws
 * AuthError(401) if there is no valid, unexpired, unrevoked session, or if
 * the underlying user/store is no longer active — callers should let this
 * propagate and translate it into an HTTP response (see the shared
 * `respondToAuthError` below), which is exactly what forces every protected
 * route through the same checks instead of ad hoc reimplementations.
 */
export async function requireStoreSession(req: Request): Promise<StoreSessionContext> {
  const rawToken = readStoreSessionToken(req);
  if (!rawToken) {
    throw new AuthError(401, 'NO_SESSION', 'Not authenticated.');
  }

  const tokenHash = await hashToken(rawToken);

  const { data: session, error: sessionError } = await supabaseAdmin
    .from('store_user_sessions')
    .select('id, store_user_id, store_id, expires_at, revoked_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (sessionError || !session) {
    throw new AuthError(401, 'INVALID_SESSION', 'Session is invalid.');
  }
  if (session.revoked_at) {
    throw new AuthError(401, 'SESSION_REVOKED', 'Session has been revoked.');
  }
  if (new Date(session.expires_at).getTime() <= Date.now()) {
    throw new AuthError(401, 'SESSION_EXPIRED', 'Session has expired.');
  }

  const { data: user, error: userError } = await supabaseAdmin
    .from('store_users')
    .select('id, store_id, login_id, full_name, status, role_id')
    .eq('id', session.store_user_id)
    .maybeSingle();

  if (userError || !user) {
    throw new AuthError(401, 'INVALID_SESSION', 'Session is invalid.');
  }
  if (user.status !== 'active') {
    throw new AuthError(403, 'USER_INACTIVE', 'This user account is not active.');
  }

  const { data: store, error: storeError } = await supabaseAdmin
    .from('stores')
    .select('id, store_code, business_name, status')
    .eq('id', session.store_id)
    .maybeSingle();

  if (storeError || !store) {
    throw new AuthError(401, 'INVALID_SESSION', 'Session is invalid.');
  }
  if (store.status !== 'active') {
    throw new AuthError(403, 'STORE_INACTIVE', 'This store account is currently unavailable.');
  }

  const permissions = await loadStoreUserPermissions(user.role_id);

  // Throttled activity update — see updateSessionActivity() below; callers
  // decide whether to invoke it (not every request needs to write).

  const subscription = await loadSubscriptionSummary(store.id);

  return {
    kind: 'store_user',
    sessionId: session.id,
    storeUserId: user.id,
    storeId: store.id,
    storeCode: store.store_code,
    storeStatus: store.status,
    storeName: store.business_name,
    loginId: user.login_id,
    fullName: user.full_name,
    roleId: user.role_id,
    permissions,
    subscription,
  };
}

export async function requireSaasAdminSession(req: Request): Promise<SaasSessionContext> {
  const rawToken = readSaasSessionToken(req);
  if (!rawToken) {
    throw new AuthError(401, 'NO_SESSION', 'Not authenticated.');
  }

  const tokenHash = await hashToken(rawToken);

  const { data: session, error: sessionError } = await supabaseAdmin
    .from('saas_admin_sessions')
    .select('id, saas_admin_id, expires_at, revoked_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (sessionError || !session) {
    throw new AuthError(401, 'INVALID_SESSION', 'Session is invalid.');
  }
  if (session.revoked_at) {
    throw new AuthError(401, 'SESSION_REVOKED', 'Session has been revoked.');
  }
  if (new Date(session.expires_at).getTime() <= Date.now()) {
    throw new AuthError(401, 'SESSION_EXPIRED', 'Session has expired.');
  }

  const { data: admin, error: adminError } = await supabaseAdmin
    .from('saas_admins')
    .select('id, login_id, full_name, status')
    .eq('id', session.saas_admin_id)
    .maybeSingle();

  if (adminError || !admin) {
    throw new AuthError(401, 'INVALID_SESSION', 'Session is invalid.');
  }
  if (admin.status !== 'active') {
    throw new AuthError(403, 'USER_INACTIVE', 'This admin account is not active.');
  }

  return {
    kind: 'saas_admin',
    sessionId: session.id,
    saasAdminId: admin.id,
    loginId: admin.login_id,
    fullName: admin.full_name,
  };
}

/**
 * Loads a compact subscription summary for a store using
 * get_store_subscription_context() (Phase 4). Returns null if the store
 * somehow has no subscription row (shouldn't happen for stores created via
 * create_store_with_admin, but older/manually-inserted rows might lack
 * one) — callers treat null as "no subscription info available" rather
 * than failing the whole session lookup, since store login itself must
 * keep working even if subscription data is temporarily inconsistent.
 */
async function loadSubscriptionSummary(storeId: string): Promise<SubscriptionSummary | null> {
  const { data, error } = await supabaseAdmin.rpc('get_store_subscription_context', { p_store_id: storeId });
  if (error) {
    console.error('[auth] failed to load subscription context:', error.message);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;

  return {
    status: row.status,
    effectiveStatus: row.effective_status,
    planCode: row.plan_code,
    planName: row.plan_name,
    currentPeriodEnd: row.current_period_end,
    daysRemaining: row.days_remaining,
  };
}

/**
 * Guard for future business-module endpoints (Products, Sales, POS, ...).
 * Phase 4 itself has no business modules to protect yet, but this is the
 * single choke point every future endpoint should call right after
 * requireStoreSession() so none of them have to reimplement subscription
 * enforcement individually. Throws 402 if the subscription has expired or
 * been suspended/cancelled — distinct from 403 (permission denied) so the
 * frontend can route to /subscription-expired specifically rather than a
 * generic "forbidden" screen.
 */
export function requireActiveSubscription(context: StoreSessionContext): void {
  if (!context.subscription) {
    // No subscription row at all is treated as not-yet-provisioned rather
    // than expired — block business access with the same status code so
    // the frontend handles it identically, but log for investigation since
    // every store should have one.
    console.error('[auth] store has no subscription context:', context.storeId);
    throw new AuthError(402, 'SUBSCRIPTION_REQUIRED', 'This store has no active subscription.');
  }
  if (context.subscription.effectiveStatus === 'expired') {
    throw new AuthError(402, 'SUBSCRIPTION_EXPIRED', 'Your store subscription has expired. Please contact the service provider.');
  }
  if (context.subscription.effectiveStatus === 'suspended') {
    throw new AuthError(402, 'SUBSCRIPTION_SUSPENDED', 'Your store subscription is suspended. Please contact the service provider.');
  }
  if (context.subscription.effectiveStatus === 'cancelled') {
    throw new AuthError(402, 'SUBSCRIPTION_CANCELLED', 'Your store subscription has been cancelled. Please contact the service provider.');
  }
}

/** Loads the effective permission_key list for a store_user's role. */
async function loadStoreUserPermissions(roleId: string | null): Promise<string[]> {
  if (!roleId) return [];

  const { data, error } = await supabaseAdmin
    .from('role_permissions')
    .select('permissions(permission_key)')
    .eq('role_id', roleId);

  if (error || !data) return [];

  return data
    .map((row) => (row as { permissions: { permission_key: string } | null }).permissions?.permission_key)
    .filter((key): key is string => Boolean(key));
}

/** Backend permission check — reject with 403 if the permission is missing. */
export function requirePermission(context: StoreSessionContext, permissionKey: string): void {
  if (!context.permissions.includes(permissionKey)) {
    throw new AuthError(403, 'PERMISSION_DENIED', `Missing required permission: ${permissionKey}`);
  }
}

/**
 * Throttled last_activity_at update — only writes if the last recorded
 * activity is more than 5 minutes old, so we don't hammer the database on
 * every single request from an active session.
 */
export async function touchSessionActivity(
  table: 'store_user_sessions' | 'saas_admin_sessions',
  sessionId: string
): Promise<void> {
  const THROTTLE_MS = 5 * 60 * 1000;

  const { data } = await supabaseAdmin.from(table).select('last_activity_at').eq('id', sessionId).maybeSingle();

  if (data && Date.now() - new Date(data.last_activity_at).getTime() < THROTTLE_MS) {
    return;
  }

  await supabaseAdmin.from(table).update({ last_activity_at: new Date().toISOString() }).eq('id', sessionId);
}

/** Converts an AuthError (or unknown error) into a safe HTTP Response body/status. */
export function authErrorResponse(error: unknown): { status: number; body: { code: string; message: string } } {
  if (error instanceof AuthError) {
    return { status: error.status, body: { code: error.code, message: error.message } };
  }
  console.error('[auth] unexpected error:', error);
  return { status: 500, body: { code: 'INTERNAL_ERROR', message: 'Something went wrong.' } };
}
