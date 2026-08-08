// SERVER-ONLY (Deno Edge Function runtime).
// POST /functions/v1/saas-create-store
//
// SaaS Admin only. Validates input, hashes the initial Store Admin password
// here (never in Postgres, never in the browser), then delegates the actual
// creation to create_store_with_admin() — a single Postgres function call
// that either fully succeeds or fully rolls back (see
// supabase/migrations/0014_store_management_functions.sql).
//
// The client NEVER supplies: store id, store_code, password hash, or role
// id — all of those are determined server-side.

import { supabaseAdmin } from '../_shared/db.ts';
import { hashPassword, isPasswordStrongEnough } from '../_shared/password.ts';
import { requireSaasAdminSession, authErrorResponse } from '../_shared/authMiddleware.ts';
import { handlePreflight } from '../_shared/cors.ts';
import { jsonResponse, isPlausibleEmail, isPlausibleCurrencyCode, isPlausibleTimezone } from '../_shared/saasHelpers.ts';
import { writeAuditLog } from '../_shared/audit.ts';
import { clientIp } from '../_shared/rateLimit.ts';

interface CreateStorePayload {
  businessName?: string;
  legalName?: string;
  ownerName?: string;
  mobile?: string;
  whatsapp?: string;
  email?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  currencyCode?: string;
  timezone?: string;
  taxNumber?: string;
  planId?: string; // omit / null -> auto-assign the TRIAL plan
  billingCycle?: 'trial' | 'monthly' | 'yearly' | 'custom';
  admin: {
    fullName?: string;
    loginId?: string;
    password?: string;
    confirmPassword?: string;
    phone?: string;
  };
}

function requiredString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  const origin = req.headers.get('origin');
  const ip = clientIp(req);

  if (req.method !== 'POST') {
    return jsonResponse(405, { code: 'METHOD_NOT_ALLOWED', message: 'Use POST.' }, origin);
  }

  let saasAdminId: string;
  try {
    const context = await requireSaasAdminSession(req);
    saasAdminId = context.saasAdminId;
  } catch (error) {
    const { status, body } = authErrorResponse(error);
    return jsonResponse(status, body, origin);
  }

  let payload: CreateStorePayload;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse(400, { code: 'BAD_REQUEST', message: 'Invalid request body.' }, origin);
  }

  // --- Validation (backend is the real gate; frontend validation is UX only) ---
  const errors: Record<string, string> = {};

  if (!requiredString(payload.businessName)) errors.businessName = 'Business name is required.';
  if (!requiredString(payload.ownerName)) errors.ownerName = 'Owner name is required.';
  if (!requiredString(payload.mobile)) errors.mobile = 'Mobile number is required.';
  if (!requiredString(payload.addressLine1)) errors.addressLine1 = 'Address is required.';
  if (!requiredString(payload.country)) errors.country = 'Country is required.';
  if (!requiredString(payload.currencyCode) || !isPlausibleCurrencyCode(payload.currencyCode!.toUpperCase())) {
    errors.currencyCode = 'A valid 3-letter currency code is required (e.g. QAR).';
  }
  if (!requiredString(payload.timezone) || !isPlausibleTimezone(payload.timezone!)) {
    errors.timezone = 'A valid IANA timezone is required (e.g. Asia/Qatar).';
  }
  if (payload.email && !isPlausibleEmail(payload.email)) errors.email = 'Email is not valid.';

  if (!payload.admin || !requiredString(payload.admin.fullName)) errors.adminFullName = 'Admin full name is required.';
  if (!payload.admin || !requiredString(payload.admin.loginId)) errors.adminLoginId = 'Admin login ID is required.';
  if (!payload.admin || !requiredString(payload.admin.password)) {
    errors.adminPassword = 'Admin password is required.';
  } else if (!isPasswordStrongEnough(payload.admin.password!)) {
    errors.adminPassword = 'Password must be at least 8 characters.';
  }
  if (payload.admin?.password !== payload.admin?.confirmPassword) {
    errors.adminConfirmPassword = 'Passwords do not match.';
  }

  if (Object.keys(errors).length > 0) {
    return jsonResponse(400, { code: 'VALIDATION_ERROR', message: 'Please correct the highlighted fields.', errors }, origin);
  }

  // --- Duplicate pre-checks (friendly errors; DB constraints are the final protection) ---
  const trimmedMobile = payload.mobile!.trim();
  const { data: existingMobile } = await supabaseAdmin
    .from('stores')
    .select('id')
    .eq('mobile', trimmedMobile)
    .maybeSingle();
  if (existingMobile) {
    return jsonResponse(
      409,
      { code: 'DUPLICATE_MOBILE', message: 'A store with this mobile number already exists.' },
      origin
    );
  }

  if (payload.taxNumber) {
    const { data: existingTax } = await supabaseAdmin
      .from('stores')
      .select('id')
      .eq('tax_number', payload.taxNumber)
      .maybeSingle();
    if (existingTax) {
      return jsonResponse(
        409,
        { code: 'DUPLICATE_TAX_NUMBER', message: 'A store with this tax number already exists.' },
        origin
      );
    }
  }

  // --- Hash the admin password server-side ---
  const adminPasswordHash = await hashPassword(payload.admin.password!);

  // --- Atomic creation ---
  const { data, error } = await supabaseAdmin.rpc('create_store_with_admin', {
    p_business_name: payload.businessName!.trim(),
    p_legal_name: payload.legalName?.trim() ?? '',
    p_owner_name: payload.ownerName!.trim(),
    p_mobile: trimmedMobile,
    p_whatsapp: payload.whatsapp?.trim() ?? '',
    p_email: payload.email?.trim() ?? '',
    p_address_line_1: payload.addressLine1!.trim(),
    p_address_line_2: payload.addressLine2?.trim() ?? '',
    p_city: payload.city?.trim() ?? '',
    p_state: payload.state?.trim() ?? '',
    p_country: payload.country!.trim(),
    p_postal_code: payload.postalCode?.trim() ?? '',
    p_currency_code: payload.currencyCode!.toUpperCase(),
    p_timezone: payload.timezone!.trim(),
    p_tax_number: payload.taxNumber?.trim() ?? '',
    p_created_by: saasAdminId,
    p_admin_full_name: payload.admin.fullName!.trim(),
    p_admin_login_id: payload.admin.loginId!.trim(),
    p_admin_password_hash: adminPasswordHash,
    p_admin_phone: payload.admin.phone?.trim() ?? '',
    p_plan_id: payload.planId ?? null,
    p_billing_cycle: payload.billingCycle ?? null,
  });

  if (error) {
    console.error('[saas-create-store] transaction failed:', error.message);
    // Postgres unique-violation code is 23505 — surface a friendlier message
    // for the login_id-within-store case without leaking raw SQL.
    if (error.code === '23505') {
      return jsonResponse(409, { code: 'DUPLICATE', message: 'This store or admin login could not be created due to a conflict. Please try again.' }, origin);
    }
    return jsonResponse(500, { code: 'INTERNAL_ERROR', message: 'Could not create the store. Please try again.' }, origin);
  }

  const result = Array.isArray(data) ? data[0] : data;
  if (!result) {
    return jsonResponse(500, { code: 'INTERNAL_ERROR', message: 'Could not create the store. Please try again.' }, origin);
  }

  await writeAuditLog({
    storeId: result.store_id,
    saasAdminId,
    module: 'saas_store_management',
    action: 'store_created',
    entityType: 'store',
    entityId: result.store_id,
    ipAddress: ip,
    metadata: { storeCode: result.store_code, adminLoginId: payload.admin.loginId },
  });

  return jsonResponse(
    201,
    {
      store: { id: result.store_id, storeCode: result.store_code },
      admin: { id: result.admin_user_id, loginId: payload.admin.loginId },
    },
    origin
  );
});
