// SERVER-ONLY (Deno Edge Function runtime).
// POST /functions/v1/saas-create-plan
//
// SaaS Admin only. Creates a plan and its plan_features rows.

import { supabaseAdmin } from '../_shared/db.ts';
import { requireSaasAdminSession, authErrorResponse } from '../_shared/authMiddleware.ts';
import { handlePreflight } from '../_shared/cors.ts';
import { jsonResponse, isPlausibleCurrencyCode } from '../_shared/saasHelpers.ts';
import { writeAuditLog } from '../_shared/audit.ts';
import { clientIp } from '../_shared/rateLimit.ts';

interface CreatePlanPayload {
  name?: string;
  code?: string;
  description?: string;
  monthlyPrice?: number;
  yearlyPrice?: number;
  currencyCode?: string;
  trialDays?: number;
  maxUsers?: number | null;
  maxBranches?: number | null;
  maxProducts?: number | null;
  maxStorageMb?: number | null;
  sortOrder?: number;
  features?: Array<{ featureKey: string; enabled: boolean; limitValue?: number | null }>;
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

  let payload: CreatePlanPayload;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse(400, { code: 'BAD_REQUEST', message: 'Invalid request body.' }, origin);
  }

  const errors: Record<string, string> = {};
  if (!payload.name?.trim()) errors.name = 'Plan name is required.';
  if (!payload.code?.trim()) errors.code = 'Plan code is required.';
  const currency = (payload.currencyCode ?? 'QAR').toUpperCase();
  if (!isPlausibleCurrencyCode(currency)) errors.currencyCode = 'A valid 3-letter currency code is required.';

  if (Object.keys(errors).length > 0) {
    return jsonResponse(400, { code: 'VALIDATION_ERROR', message: 'Please correct the highlighted fields.', errors }, origin);
  }

  const code = payload.code!.trim().toUpperCase();

  const { data: plan, error } = await supabaseAdmin
    .from('subscription_plans')
    .insert({
      name: payload.name!.trim(),
      code,
      description: payload.description?.trim() || null,
      monthly_price: payload.monthlyPrice ?? 0,
      yearly_price: payload.yearlyPrice ?? 0,
      currency_code: currency,
      trial_days: payload.trialDays ?? 0,
      max_users: payload.maxUsers ?? null,
      max_branches: payload.maxBranches ?? null,
      max_products: payload.maxProducts ?? null,
      max_storage_mb: payload.maxStorageMb ?? null,
      sort_order: payload.sortOrder ?? 0,
      status: 'active',
    })
    .select('id, code')
    .single();

  if (error || !plan) {
    if (error?.code === '23505') {
      return jsonResponse(409, { code: 'DUPLICATE_CODE', message: 'A plan with this code already exists.' }, origin);
    }
    console.error('[saas-create-plan] insert failed:', error?.message);
    return jsonResponse(500, { code: 'INTERNAL_ERROR', message: 'Could not create the plan.' }, origin);
  }

  if (payload.features && payload.features.length > 0) {
    const rows = payload.features.map((f) => ({
      plan_id: plan.id,
      feature_key: f.featureKey,
      enabled: f.enabled,
      limit_value: f.limitValue ?? null,
    }));
    await supabaseAdmin.from('plan_features').insert(rows);
  }

  await writeAuditLog({
    saasAdminId,
    module: 'saas_plan_management',
    action: 'plan_created',
    entityType: 'subscription_plan',
    entityId: plan.id,
    ipAddress: ip,
    metadata: { code: plan.code },
  });

  return jsonResponse(201, { plan: { id: plan.id, code: plan.code } }, origin);
});
