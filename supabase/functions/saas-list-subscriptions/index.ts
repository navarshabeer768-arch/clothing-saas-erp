// SERVER-ONLY (Deno Edge Function runtime).
// GET /functions/v1/saas-list-subscriptions?search=&planId=&status=&billingCycle=&expiringWithinDays=&page=1&pageSize=20
//
// SaaS Admin only. Delegates to list_store_subscriptions().

import { supabaseAdmin } from '../_shared/db.ts';
import { requireSaasAdminSession, authErrorResponse } from '../_shared/authMiddleware.ts';
import { handlePreflight } from '../_shared/cors.ts';
import { jsonResponse, isValidUuid } from '../_shared/saasHelpers.ts';

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;
const VALID_STATUSES = ['trial', 'active', 'expired', 'suspended', 'cancelled'];
const VALID_CYCLES = ['trial', 'monthly', 'yearly', 'custom'];

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
  const search = url.searchParams.get('search')?.trim() || null;

  const planIdParam = url.searchParams.get('planId');
  const planId = planIdParam && isValidUuid(planIdParam) ? planIdParam : null;

  const statusParam = url.searchParams.get('status');
  const status = statusParam && VALID_STATUSES.includes(statusParam) ? statusParam : null;

  const cycleParam = url.searchParams.get('billingCycle');
  const billingCycle = cycleParam && VALID_CYCLES.includes(cycleParam) ? cycleParam : null;

  const expiringParam = Number(url.searchParams.get('expiringWithinDays'));
  const expiringWithinDays = Number.isFinite(expiringParam) && expiringParam > 0 ? Math.floor(expiringParam) : null;

  const page = Math.max(1, Math.floor(Number(url.searchParams.get('page') ?? '1') || 1));
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Math.floor(Number(url.searchParams.get('pageSize') ?? String(DEFAULT_PAGE_SIZE)) || DEFAULT_PAGE_SIZE))
  );

  const { data, error } = await supabaseAdmin.rpc('list_store_subscriptions', {
    p_search: search,
    p_plan_id: planId,
    p_status: status,
    p_billing_cycle: billingCycle,
    p_expiring_within_days: expiringWithinDays,
    p_page: page,
    p_page_size: pageSize,
  });

  if (error) {
    console.error('[saas-list-subscriptions] query failed:', error.message);
    return jsonResponse(500, { code: 'INTERNAL_ERROR', message: 'Could not load subscriptions.' }, origin);
  }

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const totalCount = rows.length > 0 ? Number(rows[0].total_count) : 0;
  const totalPages = pageSize > 0 ? Math.max(Math.ceil(totalCount / pageSize), 1) : 1;

  const subscriptions = rows.map((row) => ({
    storeId: row.store_id,
    storeCode: row.store_code,
    businessName: row.business_name,
    planId: row.plan_id,
    planName: row.plan_name,
    status: row.status,
    effectiveStatus: row.effective_status,
    billingCycle: row.billing_cycle,
    startedAt: row.started_at,
    currentPeriodEnd: row.current_period_end,
    daysRemaining: row.days_remaining,
  }));

  return jsonResponse(200, { subscriptions, pagination: { page, pageSize, totalCount, totalPages } }, origin);
});
