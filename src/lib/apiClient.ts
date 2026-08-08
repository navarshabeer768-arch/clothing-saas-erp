import { AppError } from './errors';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';

/**
 * All privileged operations (login, password verification, store creation,
 * session management, etc.) go through this client to the trusted
 * server-side API — never directly through the Supabase browser client.
 * The Phase 2 endpoints this calls are expected to live under
 * `${VITE_API_BASE_URL}/api/...`; none exist yet in Phase 1, so calling
 * these before Phase 2 will surface a clear AppError rather than failing
 * silently.
 */

let currentToken: string | null = null;

export function setApiSessionToken(token: string | null) {
  currentToken = token;
}

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
      headers: {
        'Content-Type': 'application/json',
        ...(currentToken ? { Authorization: `Bearer ${currentToken}` } : {}),
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
    try {
      const payload = await response.json();
      if (typeof payload?.message === 'string') message = payload.message;
      if (typeof payload?.code === 'string') code = payload.code;
    } catch {
      // Response body wasn't JSON — keep the generic message above.
    }
    throw new AppError(code, message, { status: response.status });
  }

  if (response.status === 204) {
    return undefined as TResponse;
  }

  return (await response.json()) as TResponse;
}
