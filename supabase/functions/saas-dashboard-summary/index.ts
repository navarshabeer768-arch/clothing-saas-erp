// SERVER-ONLY (Deno Edge Function runtime).
// GET /functions/v1/saas-dashboard-summary
//
// SaaS Admin only. Returns aggregate store/user counts (via the
// saas_dashboard_summary() SQL function — one query, no N+1), the most
// recently created stores, and recent SaaS-level audit activity. No
// invented revenue/subscription metrics — those modules don't exist yet.

import { supabaseAdmin } from '../_shared/db.ts';
import { requireSaasAdminSession, authErrorResponse } from '../_shared/authMiddleware.ts';
import { handlePreflight } from '../_shared/cors.ts';
import { jsonResponse } from '../_shared/saasHelpers.ts';

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

  const { data: summaryRows, error: summaryError } = await supabaseAdmin.rpc('saas_dashboard_summary');
  if (summaryError) {
    console.error('[saas-dashboard-summary] summary query failed:', summaryError.message);
    return jsonResponse(500, { code: 'INTERNAL_ERROR', message: 'Could not load dashboard summary.' }, origin);
  }
  const summary = Array.isArray(summaryRows) ? summaryRows[0] : summaryRows;

  const { data: subSummaryRows, error: subSummaryError } = await supabaseAdmin.rpc('saas_subscription_dashboard_summary');
  if (subSummaryError) {
    console.error('[saas-dashboard-summary] subscription summary query failed:', subSummaryError.message);
  }
  const subSummary = Array.isArray(subSummaryRows) ? subSummaryRows[0] : subSummaryRows;

  const { data: expiringSoon } = await supabaseAdmin.rpc('list_store_subscriptions', {
    p_search: null,
    p_plan_id: null,
    p_status: null,
    p_billing_cycle: null,
    p_expiring_within_days: 7,
    p_page: 1,
    p_page_size: 5,
  });

  const { data: recentStores } = await supabaseAdmin
    .from('stores')
    .select('id, store_code, business_name, owner_name, status, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  const { data: recentActivity } = await supabaseAdmin
    .from('audit_logs')
    .select('id, action, module, created_at, store_id, saas_admin_id')
    .eq('module', 'saas_store_management')
    .order('created_at', { ascending: false })
    .limit(10);

  return jsonResponse(
    200,
    {
      summary: {
        totalStores: Number(summary?.total_stores ?? 0),
        activeStores: Number(summary?.active_stores ?? 0),
        suspendedStores: Number(summary?.suspended_stores ?? 0),
        archivedStores: Number(summary?.archived_stores ?? 0),
        inactiveStores: Number(summary?.inactive_stores ?? 0),
        totalStoreUsers: Number(summary?.total_store_users ?? 0),
        storesCreatedThisMonth: Number(summary?.stores_created_this_month ?? 0),
        trialStores: Number(subSummary?.trial_stores ?? 0),
        activeSubscriptions: Number(subSummary?.active_subscriptions ?? 0),
        expiredSubscriptions: Number(subSummary?.expired_subscriptions ?? 0),
        expiringWithin7Days: Number(subSummary?.expiring_within_7_days ?? 0),
        expiringWithin30Days: Number(subSummary?.expiring_within_30_days ?? 0),
      },
      expiringSoon: (expiringSoon ?? []).map((row: Record<string, unknown>) => ({
        storeId: row.store_id,
        storeCode: row.store_code,
        businessName: row.business_name,
        planName: row.plan_name,
        currentPeriodEnd: row.current_period_end,
        daysRemaining: row.days_remaining,
      })),
      recentStores: (recentStores ?? []).map((s) => ({
        id: s.id,
        storeCode: s.store_code,
        businessName: s.business_name,
        ownerName: s.owner_name,
        status: s.status,
        createdAt: s.created_at,
      })),
      recentActivity: (recentActivity ?? []).map((a) => ({
        id: a.id,
        action: a.action,
        createdAt: a.created_at,
        storeId: a.store_id,
      })),
    },
    origin
  );
});
