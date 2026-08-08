// SERVER-ONLY (Deno Edge Function runtime).
// GET /functions/v1/saas-get-store-subscription?storeId=<uuid>
//
// SaaS Admin only. Full subscription card data for /saas/stores/:id.

import { supabaseAdmin } from '../_shared/db.ts';
import { requireSaasAdminSession, authErrorResponse } from '../_shared/authMiddleware.ts';
import { handlePreflight } from '../_shared/cors.ts';
import { jsonResponse, isValidUuid } from '../_shared/saasHelpers.ts';

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  const origin = req.headers.get('origin');

  if (req.method !== 'GET') {
    return jsonResponse(405, { code: 'METHOD_NOT_ALLOWED', message: 'Use GET.' }, origin);
  }

  try {
    await requireSaasAdminSession(req);
  } catch (error) {
    const { status, body } = authErrorResponse(error);
    return jsonResponse(status, body, origin);
  }

  const url = new URL(req.url);
  const storeId = url.searchParams.get('storeId');
  if (!isValidUuid(storeId)) {
    return jsonResponse(400, { code: 'BAD_REQUEST', message: 'A valid storeId is required.' }, origin);
  }

  const { data: contextRows, error: contextError } = await supabaseAdmin.rpc('get_store_subscription_context', {
    p_store_id: storeId,
  });
  if (contextError) {
    console.error('[saas-get-store-subscription] context query failed:', contextError.message);
    return jsonResponse(500, { code: 'INTERNAL_ERROR', message: 'Could not load subscription.' }, origin);
  }
  const context = Array.isArray(contextRows) ? contextRows[0] : contextRows;

  if (!context) {
    return jsonResponse(200, { subscription: null, usage: null, history: [] }, origin);
  }

  const { data: userCountRows } = await supabaseAdmin.rpc('check_plan_limit', { p_store_id: storeId, p_limit_key: 'users' });
  const userLimit = Array.isArray(userCountRows) ? userCountRows[0] : userCountRows;

  const { data: history } = await supabaseAdmin
    .from('subscription_history')
    .select('id, action, old_plan_id, new_plan_id, old_status, new_status, effective_at, performed_by_saas_admin, metadata')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })
    .limit(20);

  const planIds = Array.from(
    new Set((history ?? []).flatMap((h) => [h.old_plan_id, h.new_plan_id]).filter((id): id is string => Boolean(id)))
  );
  const { data: plans } = planIds.length
    ? await supabaseAdmin.from('subscription_plans').select('id, name').in('id', planIds)
    : { data: [] as Array<{ id: string; name: string }> };
  const planNameById = new Map((plans ?? []).map((p) => [p.id, p.name]));

  return jsonResponse(
    200,
    {
      subscription: {
        subscriptionId: context.subscription_id,
        planId: context.plan_id,
        planName: context.plan_name,
        planCode: context.plan_code,
        status: context.status,
        effectiveStatus: context.effective_status,
        billingCycle: context.billing_cycle,
        currentPeriodStart: context.current_period_start,
        currentPeriodEnd: context.current_period_end,
        daysRemaining: context.days_remaining,
        featureKeys: context.feature_keys ?? [],
      },
      usage: {
        users: { current: userLimit?.current_count ?? null, limit: context.max_users },
        branches: { current: null, limit: context.max_branches },
        products: { current: null, limit: context.max_products },
      },
      history: (history ?? []).map((h) => ({
        id: h.id,
        action: h.action,
        previousPlanName: h.old_plan_id ? planNameById.get(h.old_plan_id) ?? null : null,
        newPlanName: h.new_plan_id ? planNameById.get(h.new_plan_id) ?? null : null,
        previousStatus: h.old_status,
        newStatus: h.new_status,
        effectiveAt: h.effective_at,
        performedBySaasAdmin: Boolean(h.performed_by_saas_admin),
        notes: (h.metadata as Record<string, unknown> | null)?.notes ?? null,
      })),
    },
    origin
  );
});
