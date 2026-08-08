// SERVER-ONLY (Deno Edge Function runtime). Never imported from src/.
//
// Session tokens are opaque, cryptographically-random strings. Only a
// SHA-256 hash of the token is ever persisted (store_user_sessions.token_hash
// / saas_admin_sessions.token_hash) — the raw token exists only transiently
// in this request, and is handed to the browser exclusively via a
// Set-Cookie header (never in a JSON body field that could end up logged or
// cached).

const TOKEN_BYTE_LENGTH = 32; // 256 bits of entropy

/** Generates a new opaque session token using a CSPRNG (never Math.random/timestamps). */
export function generateSessionToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTE_LENGTH);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

/** SHA-256 hash of a raw token, for storage/lookup as token_hash. */
export async function hashToken(rawToken: string): Promise<string> {
  const data = new TextEncoder().encode(rawToken);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return toHex(new Uint8Array(digest));
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
