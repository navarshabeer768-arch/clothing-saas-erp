// SERVER-ONLY (Deno Edge Function runtime).
// POST /functions/v1/saas-change-store-plan
// Body: { storeId, newPlanId, billingCycle, periodEnd?, notes? }
//
// SaaS Admin only. Upgrade/downgrade a store's plan, effective immediately
// (manual administration, no payment gateway — Phase 4 §29/§45).

import { supabaseAdmin } from '../_shared/db.ts';
import { requireSaasAdminSession, authErrorResponse } from '../_shared/authMiddleware.ts';
import { handlePreflight } from '../_shared/cors.ts';
import { jsonResponse, isValidUuid } from '../_shared/saasHelpers.ts';

const VALID_CYCLES = ['trial', 'monthly', 'yearly', 'custom'];

function defaultPeriodEnd(billingCycle: string): string {
  const now = new Date();
  if (billingCycle === 'yearly') now.setFullYear(now.getFullYear() + 1);
  else now.setMonth(now.getMonth() + 1);
  return now.toISOString();
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  const origin = req.headers.get('origin');

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

  let payload: { storeId?: string; newPlanId?: string; billingCycle?: string; periodEnd?: string; notes?: string };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse(400, { code: 'BAD_REQUEST', message: 'Invalid request body.' }, origin);
  }

  if (!isValidUuid(payload.storeId) || !isValidUuid(payload.newPlanId)) {
    return jsonResponse(400, { code: 'BAD_REQUEST', message: 'A valid storeId and newPlanId are required.' }, origin);
  }
  const billingCycle = payload.billingCycle && VALID_CYCLES.includes(payload.billingCycle) ? payload.billingCycle : 'monthly';

  const { data: plan } = await supabaseAdmin.from('subscription_plans').select('id, status').eq('id', payload.newPlanId).maybeSingle();
  if (!plan) {
    return jsonResponse(404, { code: 'PLAN_NOT_FOUND', message: 'Plan not found.' }, origin);
  }
  if (plan.status === 'archived') {
    return jsonResponse(400, { code: 'PLAN_ARCHIVED', message: 'This plan is archived and cannot be assigned to stores.' }, origin);
  }

  const periodEnd = payload.periodEnd ?? defaultPeriodEnd(billingCycle);

  const { data: subscriptionId, error } = await supabaseAdmin.rpc('change_store_subscription_plan', {
    p_store_id: payload.storeId,
    p_new_plan_id: payload.newPlanId,
    p_billing_cycle: billingCycle,
    p_period_end: periodEnd,
    p_saas_admin_id: saasAdminId,
    p_notes: payload.notes ?? null,
  });

  if (error) {
    console.error('[saas-change-store-plan] failed:', error.message);
    return jsonResponse(500, { code: 'INTERNAL_ERROR', message: 'Could not change the subscription plan.' }, origin);
  }

  return jsonResponse(200, { success: true, subscriptionId }, origin);
});
