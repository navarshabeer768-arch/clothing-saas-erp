// SERVER-ONLY (Deno Edge Function runtime).
// POST /functions/v1/saas-extend-subscription
// Body: { storeId, days?, customDate?, reason? }
//
// SaaS Admin only. Pushes current_period_end forward without changing plan
// or otherwise touching billing_cycle — a goodwill/support extension.

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

  let payload: { storeId?: string; days?: number; customDate?: string; reason?: string };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse(400, { code: 'BAD_REQUEST', message: 'Invalid request body.' }, origin);
  }

  if (!isValidUuid(payload.storeId)) {
    return jsonResponse(400, { code: 'BAD_REQUEST', message: 'A valid storeId is required.' }, origin);
  }
  if (!payload.days && !payload.customDate) {
    return jsonResponse(400, { code: 'BAD_REQUEST', message: 'Provide either days or customDate.' }, origin);
  }

  const { data: existing } = await supabaseAdmin
    .from('store_subscriptions')
    .select('current_period_end')
    .eq('store_id', payload.storeId)
    .maybeSingle();

  if (!existing) {
    return jsonResponse(404, { code: 'SUBSCRIPTION_NOT_FOUND', message: 'This store has no subscription to extend.' }, origin);
  }

  let newPeriodEnd: Date;
  if (payload.customDate) {
    newPeriodEnd = new Date(payload.customDate);
    if (Number.isNaN(newPeriodEnd.getTime())) {
      return jsonResponse(400, { code: 'BAD_REQUEST', message: 'customDate is not a valid date.' }, origin);
    }
  } else {
    const base = new Date(Math.max(new Date(existing.current_period_end).getTime(), Date.now()));
    newPeriodEnd = new Date(base.getTime() + (payload.days ?? 0) * 24 * 60 * 60 * 1000);
  }

  const { data: subscriptionId, error } = await supabaseAdmin.rpc('extend_store_subscription', {
    p_store_id: payload.storeId,
    p_new_period_end: newPeriodEnd.toISOString(),
    p_saas_admin_id: saasAdminId,
    p_reason: payload.reason ?? null,
  });

  if (error) {
    console.error('[saas-extend-subscription] failed:', error.message);
    return jsonResponse(500, { code: 'INTERNAL_ERROR', message: 'Could not extend the subscription.' }, origin);
  }

  return jsonResponse(200, { success: true, subscriptionId, newPeriodEnd: newPeriodEnd.toISOString() }, origin);
});
