// SERVER-ONLY (Deno Edge Function runtime).
// POST /functions/v1/saas-renew-subscription
// Body: { storeId, months?, years?, customPeriodEnd?, billingCycle?, notes? }
//
// SaaS Admin only. Renews for 1/3/6 months, 1 year, or a custom date. Uses
// real calendar-date arithmetic (JS Date month/year rollover), not a naive
// "+30 days per month" approximation, per Phase 4 §30.

import { supabaseAdmin } from '../_shared/db.ts';
import { requireSaasAdminSession, authErrorResponse } from '../_shared/authMiddleware.ts';
import { handlePreflight } from '../_shared/cors.ts';
import { jsonResponse, isValidUuid } from '../_shared/saasHelpers.ts';

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

  let payload: {
    storeId?: string;
    months?: number;
    years?: number;
    customPeriodEnd?: string;
    billingCycle?: string;
    notes?: string;
  };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse(400, { code: 'BAD_REQUEST', message: 'Invalid request body.' }, origin);
  }

  if (!isValidUuid(payload.storeId)) {
    return jsonResponse(400, { code: 'BAD_REQUEST', message: 'A valid storeId is required.' }, origin);
  }

  const { data: existing } = await supabaseAdmin
    .from('store_subscriptions')
    .select('current_period_end')
    .eq('store_id', payload.storeId)
    .maybeSingle();

  if (!existing) {
    return jsonResponse(404, { code: 'SUBSCRIPTION_NOT_FOUND', message: 'This store has no subscription to renew.' }, origin);
  }

  let periodEnd: Date;
  if (payload.customPeriodEnd) {
    periodEnd = new Date(payload.customPeriodEnd);
    if (Number.isNaN(periodEnd.getTime())) {
      return jsonResponse(400, { code: 'BAD_REQUEST', message: 'customPeriodEnd is not a valid date.' }, origin);
    }
  } else {
    // Start from whichever is later: current period end (so paid time
    // isn't lost) or now (so a long-expired subscription renews from
    // today, not from years in the past).
    const base = new Date(Math.max(new Date(existing.current_period_end).getTime(), Date.now()));
    periodEnd = new Date(base);
    if (payload.years) periodEnd.setFullYear(periodEnd.getFullYear() + payload.years);
    if (payload.months) periodEnd.setMonth(periodEnd.getMonth() + payload.months);
    if (!payload.years && !payload.months) periodEnd.setMonth(periodEnd.getMonth() + 1); // default: 1 month
  }

  const billingCycle = payload.billingCycle ?? (payload.years ? 'yearly' : 'monthly');

  const { data: subscriptionId, error } = await supabaseAdmin.rpc('renew_store_subscription', {
    p_store_id: payload.storeId,
    p_period_end: periodEnd.toISOString(),
    p_billing_cycle: billingCycle,
    p_saas_admin_id: saasAdminId,
    p_notes: payload.notes ?? null,
  });

  if (error) {
    console.error('[saas-renew-subscription] failed:', error.message);
    return jsonResponse(500, { code: 'INTERNAL_ERROR', message: 'Could not renew the subscription.' }, origin);
  }

  return jsonResponse(200, { success: true, subscriptionId, newPeriodEnd: periodEnd.toISOString() }, origin);
});
