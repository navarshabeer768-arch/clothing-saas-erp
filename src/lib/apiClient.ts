import { AppError } from './errors';

/**
 * All privileged operations (login, password verification, store creation,
 * session management, etc.) go through this client to the trusted
 * server-side Edge Functions — never directly through the Supabase browser
 * client.
 *
 * Base URL: Supabase Edge Functions live at
 * `${SUPABASE_URL}/functions/v1/<function-name>`. VITE_API_BASE_URL should
 * be set to that base (e.g. `https://yvxsyvgccxdvmgazvofm.supabase.co/functions/v1`)
 * once the functions are deployed — see supabase/functions/README.md.
 *
 * AUTH TRANSPORT: session auth uses an HttpOnly cookie set by the server
 * (see supabase/functions/_shared/cookies.ts), not a bearer token kept in
 * JS. `credentials: 'include'` is required on every call so the browser
 * attaches/receives that cookie cross-origin (GitHub Pages frontend calling
 * a Supabase Edge Function origin) — see docs/ARCHITECTURE.md §8.1 for the
 * Safari third-party-cookie caveat that comes with that cross-origin setup.
 */

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
}

export async function apiRequest<TResponse>(
  path: string,
  options: RequestOptions = {}
): Promise<TResponse> {
  const { method = 'GET', body, signal } = options;

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      signal,
      credentials: 'include', // send/receive the HttpOnly session cookie
      headers: {
        'Content-Type': 'application/json',
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (networkError) {
    throw new AppError(
      'NETWORK_ERROR',
      'Could not reach the server. Please check your connection and try again.',
      { cause: networkError }
    );
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    let code = 'REQUEST_FAILED';
    let fieldErrors: Record<string, string> | undefined;
    try {
      const payload = await response.json();
      if (typeof payload?.message === 'string') message = payload.message;
      if (typeof payload?.code === 'string') code = payload.code;
      if (payload?.errors && typeof payload.errors === 'object') fieldErrors = payload.errors;
    } catch {
      // Response body wasn't JSON — keep the generic message above.
    }
    throw new AppError(code, message, { status: response.status, errors: fieldErrors });
  }

  if (response.status === 204) {
    return undefined as TResponse;
  }

  return (await response.json()) as TResponse;
}
