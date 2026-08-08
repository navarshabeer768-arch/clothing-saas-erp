// SERVER-ONLY (Deno Edge Function runtime). Never imported from src/.
//
// SESSION TRANSPORT DECISION: HttpOnly, Secure, SameSite=None cookies are
// the primary transport, per the security requirement that the primary auth
// token must never live in localStorage/sessionStorage/JS-readable state.
//
// KNOWN LIMITATION (documented per the requirement to explain deviations):
// the frontend is hosted on GitHub Pages (a different origin/domain than
// this Edge Function), so this is a genuinely cross-site cookie. That
// requires SameSite=None; Secure, which works in Chrome/Firefox/Edge with
// `credentials: 'include'`, but Safari's Intelligent Tracking Prevention
// blocks third-party cookies by default and will silently drop this cookie.
// This is a hosting-topology limitation, not a gap in the auth design.
// The durable fix is to serve the API from the same registrable domain as
// the frontend (e.g. a custom domain with the SPA at app.example.com and
// the API at api.example.com — same eTLD+1, so cookies are first-party), or
// to move the API behind a reverse-proxy path (example.com/api/*) on the
// same origin as the Pages deployment (not possible with plain GitHub
// Pages, but straightforward once a real domain/CDN is introduced in a
// later phase). Tracked as a Phase 3+ infra item — see docs/ARCHITECTURE.md.

const STORE_COOKIE_NAME = 'store_session';
const SAAS_COOKIE_NAME = 'saas_session';

const STORE_SESSION_TTL_SECONDS = 10 * 60 * 60; // 10 hours
const SAAS_SESSION_TTL_SECONDS = 10 * 60 * 60; // 10 hours

export const SESSION_TTL = {
  store: STORE_SESSION_TTL_SECONDS,
  saas: SAAS_SESSION_TTL_SECONDS,
};

function buildCookie(name: string, value: string, maxAgeSeconds: number): string {
  const parts = [
    `${name}=${value}`,
    'Path=/',
    `Max-Age=${maxAgeSeconds}`,
    'HttpOnly',
    'Secure',
    'SameSite=None',
  ];
  return parts.join('; ');
}

function buildClearCookie(name: string): string {
  return `${name}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=None`;
}

export function setStoreSessionCookie(rawToken: string): string {
  return buildCookie(STORE_COOKIE_NAME, rawToken, STORE_SESSION_TTL_SECONDS);
}

export function setSaasSessionCookie(rawToken: string): string {
  return buildCookie(SAAS_COOKIE_NAME, rawToken, SAAS_SESSION_TTL_SECONDS);
}

export function clearStoreSessionCookie(): string {
  return buildClearCookie(STORE_COOKIE_NAME);
}

export function clearSaasSessionCookie(): string {
  return buildClearCookie(SAAS_COOKIE_NAME);
}

/** Parses the raw Cookie header into a name->value map. */
export function parseCookies(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {};
  return Object.fromEntries(
    cookieHeader.split(';').map((pair) => {
      const [name, ...rest] = pair.trim().split('=');
      return [name, rest.join('=')];
    })
  );
}

export function readStoreSessionToken(req: Request): string | null {
  const cookies = parseCookies(req.headers.get('cookie'));
  return cookies[STORE_COOKIE_NAME] ?? null;
}

export function readSaasSessionToken(req: Request): string | null {
  const cookies = parseCookies(req.headers.get('cookie'));
  return cookies[SAAS_COOKIE_NAME] ?? null;
}
