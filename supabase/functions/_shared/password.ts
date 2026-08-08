// SERVER-ONLY (Deno Edge Function runtime). Never imported from src/.
//
// ALGORITHM CHOICE: bcrypt (via a pure-JS/WASM implementation), not Argon2id.
// Argon2id is the generally-preferred choice, but its reference
// implementations rely on native bindings that are unreliable inside a
// sandboxed Deno Edge Function runtime (no arbitrary native code execution).
// bcrypt with cost factor 12 is the explicitly-allowed fallback per the
// project's security requirements, has a mature battle-tested pure
// implementation, includes its own salt generation, and its cost factor can
// be raised later (e.g. to 13/14) without changing this interface — bcrypt
// hashes are self-describing, so verify() keeps working for old hashes even
// after the default cost factor changes.

import bcrypt from 'npm:bcryptjs@2';

const COST_FACTOR = 12;

/** Hash a plain-text password. Never call this from the browser. */
export async function hashPassword(plainTextPassword: string): Promise<string> {
  return bcrypt.hash(plainTextPassword, COST_FACTOR);
}

/**
 * Constant-time-ish verification via bcrypt's own comparison. Returns false
 * for any mismatch OR malformed hash — callers must not distinguish between
 * these cases in the response they send back to the client (see
 * store-login/index.ts: always return the same generic invalid-login
 * message regardless of *why* verification failed).
 */
export async function verifyPassword(plainTextPassword: string, storedHash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plainTextPassword, storedHash);
  } catch {
    return false;
  }
}

/** Minimum password strength rule for Phase 2 (see change-password). */
export function isPasswordStrongEnough(password: string): boolean {
  return typeof password === 'string' && password.length >= 8;
}
