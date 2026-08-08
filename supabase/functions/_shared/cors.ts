// SERVER-ONLY (Deno Edge Function runtime). Never imported from src/.
//
// CORS for credentialed (cookie-based) auth endpoints must NOT use
// "Access-Control-Allow-Origin: *" — browsers reject wildcard origin when
// credentials are involved anyway, and even if they didn't, an open policy
// would let any website read authenticated responses. We allow only known
// application origins, echoing back the specific origin when it matches.

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

// Sensible defaults for local dev + the deployed GitHub Pages frontend, used
// only if ALLOWED_ORIGINS is not set in the function's environment secrets.
const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'https://navarshabeer768-arch.github.io',
];

function resolveAllowedOrigins(): string[] {
  return ALLOWED_ORIGINS.length > 0 ? ALLOWED_ORIGINS : DEFAULT_ALLOWED_ORIGINS;
}

export function corsHeaders(requestOrigin: string | null): HeadersInit {
  const allowed = resolveAllowedOrigins();
  const origin = requestOrigin && allowed.includes(requestOrigin) ? requestOrigin : allowed[0];

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    Vary: 'Origin',
  };
}

export function handlePreflight(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req.headers.get('origin')) });
  }
  return null;
}
