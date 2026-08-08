/**
 * Standardized application error. Every service/API call should throw (or
 * normalize caught errors into) an AppError so UI code can rely on a
 * consistent shape, and so we never leak raw database/security details
 * (stack traces, SQL messages, internal identifiers) to the end user.
 */
export class AppError extends Error {
  readonly code: string;
  readonly context?: Record<string, unknown>;

  constructor(code: string, message: string, context?: Record<string, unknown>) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.context = context;
  }
}

/** User-facing message for a caught error, never exposing internals. */
export function toUserMessage(error: unknown): string {
  if (error instanceof AppError) return error.message;
  if (error instanceof Error) return 'Something went wrong. Please try again.';
  return 'An unexpected error occurred.';
}

/**
 * Central place to log errors. In Phase 1 this just logs to the console;
 * later phases can wire this into the audit_logs table (via the server API)
 * or an external monitoring service without changing call sites.
 */
export function logError(error: unknown, context?: Record<string, unknown>): void {
  // eslint-disable-next-line no-console
  console.error('[app-error]', error, context ?? {});
}
