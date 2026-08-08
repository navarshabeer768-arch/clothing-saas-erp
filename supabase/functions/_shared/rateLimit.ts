// SERVER-ONLY (Deno Edge Function runtime). Never imported from src/.

import { supabaseAdmin } from './db.ts';

const WINDOW_SECONDS = 5 * 60; // 5-minute fixed window
const IP_MAX_ATTEMPTS = 20; // generous — many legitimate users may share an IP (NAT, office wifi)
const ACCOUNT_MAX_ATTEMPTS = 8; // tighter — a specific store_id+login_id shouldn't see this many attempts

function currentWindowStart(): string {
  const now = new Date();
  const bucketMs = WINDOW_SECONDS * 1000;
  const windowStartMs = Math.floor(now.getTime() / bucketMs) * bucketMs;
  return new Date(windowStartMs).toISOString();
}

export type RateLimitScope = 'ip' | 'store_login' | 'saas_login';

/**
 * Increments the counter for a scope/key and returns whether the request
 * should be BLOCKED (true = blocked). Fails open (does not block) if the
 * rate-limit table write itself errors, so a database hiccup never takes
 * the login system down — this is a defense-in-depth layer on top of the
 * per-account lockout (failed_login_attempts/locked_until), not the only
 * line of defense.
 */
export async function checkAndIncrementRateLimit(
  scope: RateLimitScope,
  scopeKey: string
): Promise<boolean> {
  const maxAttempts = scope === 'ip' ? IP_MAX_ATTEMPTS : ACCOUNT_MAX_ATTEMPTS;
  const windowStart = currentWindowStart();

  const { data, error } = await supabaseAdmin.rpc('increment_login_rate_limit', {
    p_scope: scope,
    p_scope_key: scopeKey,
    p_window_start: windowStart,
  });

  if (error) {
    console.error('[rateLimit] failed to increment, failing open:', error.message);
    return false;
  }

  const count = typeof data === 'number' ? data : Array.isArray(data) ? data[0] : data;
  return count > maxAttempts;
}

export function clientIp(req: Request): string {
  // Supabase Edge Functions run behind a proxy that sets x-forwarded-for.
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}
