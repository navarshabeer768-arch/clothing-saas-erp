// SERVER-ONLY (Deno Edge Function runtime). Never imported from src/.

import { corsHeaders } from './cors.ts';

export function jsonResponse(status: number, body: unknown, origin: string | null, extraHeaders: HeadersInit = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin), ...extraHeaders },
  });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

const VALID_STORE_STATUSES = ['active', 'suspended', 'inactive', 'archived'];

export function isValidStoreStatus(value: unknown): value is string {
  return typeof value === 'string' && VALID_STORE_STATUSES.includes(value);
}

/** Basic, deliberately permissive email shape check — not RFC 5322 exact. */
export function isPlausibleEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** ISO 4217-style 3-letter currency code check (format only, not a full ISO list). */
export function isPlausibleCurrencyCode(value: string): boolean {
  return /^[A-Z]{3}$/.test(value);
}

/** Loose IANA timezone identifier shape check (e.g. "Asia/Qatar", "UTC"). */
export function isPlausibleTimezone(value: string): boolean {
  return /^[A-Za-z_]+(\/[A-Za-z_]+)*$/.test(value) && value.length <= 64;
}
