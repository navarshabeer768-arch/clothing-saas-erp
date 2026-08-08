/**
 * SERVER-ONLY. This file must never be imported from `src/` (the browser
 * bundle). It documents the interface Phase 2's login/registration endpoints
 * will implement and call.
 *
 * Intended implementation: Argon2id (preferred) or bcrypt with a
 * work-factor appropriate for the deployment target, plus a server-only
 * pepper (`PASSWORD_HASH_PEPPER`) concatenated with the password before
 * hashing, loaded from the server environment — never from `VITE_`-prefixed
 * variables and never bundled into the frontend.
 *
 * Phase 1 deliberately ships no runtime dependency for this yet (e.g.
 * `argon2` or `bcrypt`) to avoid pulling a native/server-only package into a
 * project that Phase 1 doesn't need to run. Add the dependency when Phase 2
 * implements the real server runtime (Edge Function / Node server).
 */

export interface PasswordHasher {
  /** Hash a plain-text password. Returns a self-describing hash string
   *  (e.g. PHC-formatted) suitable for storage in `password_hash` columns. */
  hash(plainTextPassword: string): Promise<string>;

  /** Constant-time verification of a plain-text password against a stored
   *  hash. Must never leak timing information about *why* verification
   *  failed (wrong password vs malformed hash, etc). */
  verify(plainTextPassword: string, storedHash: string): Promise<boolean>;
}

/**
 * Placeholder — throws until Phase 2 provides a real implementation backed
 * by argon2/bcrypt. Present now so call sites (login endpoint, user
 * creation endpoint) can be written against a stable contract.
 */
export const passwordHasher: PasswordHasher = {
  async hash() {
    throw new Error(
      'passwordHasher.hash() is not implemented yet — wire this up to argon2/bcrypt in Phase 2.'
    );
  },
  async verify() {
    throw new Error(
      'passwordHasher.verify() is not implemented yet — wire this up to argon2/bcrypt in Phase 2.'
    );
  },
};
