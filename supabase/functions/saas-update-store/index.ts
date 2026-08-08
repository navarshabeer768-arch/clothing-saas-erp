// SERVER-ONLY (Deno Edge Function runtime).
// PATCH /functions/v1/saas-update-store?id=<uuid>
//
// SaaS Admin only. Explicitly whitelists editable fields — deliberately NOT
// a generic `update(stores).set(req.body)`, so an unexpected/extra field in
// the request body (id, store_code, status, created_by, etc.) can never be
// written. store_code is immutable by design (see Phase 3 §16); status
// changes go through saas-store-status instead, which also handles session
// revocation.

import { supabaseAdmin } from '../_shared/db.ts';
import { requireSaasAdminSession, authErrorResponse } from '../_shared/authMiddleware.ts';
import { handlePreflight } from '../_shared/cors.ts';
import { jsonResponse, isValidUuid, isPlausibleEmail, isPlausibleCurrencyCode, isPlausibleTimezone } from '../_shared/saasHelpers.ts';
import { writeAuditLog } from '../_shared/audit.ts';
import { clientIp } from '../_shared/rateLimit.ts';

// The ONLY fields this endpoint will ever write. Anything else in the
// request body is silently ignored, not merged in.
const EDITABLE_FIELDS = [
  'businessName',
  'legalName',
  'ownerName',
  'mobile',
  'whatsapp',
  'email',
  'addressLine1',
  'addressLine2',
  'city',
  'state',
  'country',
  'postalCode',
  'currencyCode',
  'timezone',
  'taxNumber',
] as const;

const FIELD_TO_COLUMN: Record<(typeof EDITABLE_FIELDS)[number], string> = {
  businessName: 'business_name',
  legalName: 'legal_name',
  ownerName: 'owner_name',
  mobile: 'mobile',
  whatsapp: 'whatsapp',
  email: 'email',
  addressLine1: 'address_line_1',
  addressLine2: 'address_line_2',
  city: 'city',
  state: 'state',
  country: 'country',
  postalCode: 'postal_code',
  currencyCode: 'currency_code',
  timezone: 'timezone',
  taxNumber: 'tax_number',
};

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  const origin = req.headers.get('origin');
  const ip = clientIp(req);

  if (req.method !== 'PATCH') {
    return jsonResponse(405, { code: 'METHOD_NOT_ALLOWED', message: 'Use PATCH.' }, origin);
  }

  let saasAdminId: string;
  try {
    const context = await requireSaasAdminSession(req);
    saasAdminId = context.saasAdminId;
  } catch (error) {
    const { status, body } = authErrorResponse(error);
    return jsonResponse(status, body, origin);
  }

  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!isValidUuid(id)) {
    return jsonResponse(400, { code: 'BAD_REQUEST', message: 'A valid store id is required.' }, origin);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse(400, { code: 'BAD_REQUEST', message: 'Invalid request body.' }, origin);
  }

  const { data: existing } = await supabaseAdmin.from('stores').select('*').eq('id', id).maybeSingle();
  if (!existing) {
    return jsonResponse(404, { code: 'STORE_NOT_FOUND', message: 'Store not found.' }, origin);
  }

  const updates: Record<string, unknown> = {};
  const errors: Record<string, string> = {};

  for (const field of EDITABLE_FIELDS) {
    if (!(field in payload)) continue;
    const raw = payload[field];
    const value = typeof raw === 'string' ? raw.trim() : raw;

    if (field === 'email' && value && !isPlausibleEmail(String(value))) {
      errors.email = 'Email is not valid.';
      continue;
    }
    if (field === 'currencyCode' && value && !isPlausibleCurrencyCode(String(value).toUpperCase())) {
      errors.currencyCode = 'A valid 3-letter currency code is required.';
      continue;
    }
    if (field === 'timezone' && value && !isPlausibleTimezone(String(value))) {
      errors.timezone = 'A valid IANA timezone is required.';
      continue;
    }
    if ((field === 'businessName' || field === 'ownerName' || field === 'mobile' || field === 'addressLine1' || field === 'country') && !value) {
      errors[field] = 'This field is required.';
      continue;
    }

    const column = FIELD_TO_COLUMN[field];
    updates[column] = field === 'currencyCode' && value ? String(value).toUpperCase() : value || null;
  }

  if (Object.keys(errors).length > 0) {
    return jsonResponse(400, { code: 'VALIDATION_ERROR', message: 'Please correct the highlighted fields.', errors }, origin);
  }

  if (Object.keys(updates).length === 0) {
    return jsonResponse(400, { code: 'NO_CHANGES', message: 'No editable fields were provided.' }, origin);
  }

  const { data: updated, error } = await supabaseAdmin
    .from('stores')
    .update(updates)
    .eq('id', id)
    .select('id, store_code, business_name, status')
    .single();

  if (error || !updated) {
    console.error('[saas-update-store] update failed:', error?.message);
    return jsonResponse(500, { code: 'INTERNAL_ERROR', message: 'Could not update the store. Please try again.' }, origin);
  }

  const oldValuesSnapshot: Record<string, unknown> = {};
  for (const column of Object.keys(updates)) {
    oldValuesSnapshot[column] = (existing as Record<string, unknown>)[column];
  }

  await writeAuditLog({
    storeId: id,
    saasAdminId,
    module: 'saas_store_management',
    action: 'store_updated',
    entityType: 'store',
    entityId: id,
    ipAddress: ip,
    oldValues: oldValuesSnapshot,
    newValues: updates,
  });

  return jsonResponse(200, { store: { id: updated.id, storeCode: updated.store_code, businessName: updated.business_name, status: updated.status } }, origin);
});
