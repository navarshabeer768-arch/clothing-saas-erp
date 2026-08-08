/**
 * SERVER-ONLY. Never import from `src/`.
 *
 * Session tokens are opaque, high-entropy random strings handed to the
 * client exactly once at login. Only a SHA-256 (or stronger) hash of the
 * token is ever persisted, in `store_user_sessions.token_hash` or
 * `saas_admin_sessions.token_hash` (see supabase/migrations/0008_sessions.sql).
 *
 * Verifying a session means: hash the incoming bearer token the same way,
 * look up the row by `token_hash`, and check `expires_at` / `revoked_at`.
 * The resulting `store_id` (for store_user sessions) is the ONLY source of
 * truth for tenant scoping on the server — it must never be taken from a
 * request body, query string, or header supplied by the client.
 */

export interface IssuedSession {
  /** Raw token — return to the client once, never store this raw value. */
  token: string;
  tokenHash: string;
  expiresAt: string;
}

export interface SessionTokenService {
  issue(ttlSeconds: number): Promise<IssuedSession>;
  hash(rawToken: string): Promise<string>;
}

/**
 * Placeholder — throws until Phase 2 wires this to a real CSPRNG + hashing
 * implementation (e.g. Node's `crypto.randomBytes` + `crypto.subtle.digest`
 * or an Edge-Function-compatible equivalent).
 */
export const sessionTokenService: SessionTokenService = {
  async issue() {
    throw new Error('sessionTokenService.issue() is not implemented yet — build in Phase 2.');
  },
  async hash() {
    throw new Error('sessionTokenService.hash() is not implemented yet — build in Phase 2.');
  },
};
