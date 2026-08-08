// SERVER-ONLY (Deno Edge Function runtime).
// GET /functions/v1/saas-list-plans
//
// SaaS Admin only. Returns every plan (any status) with how many stores
// currently use each, via list_plans_with_store_counts().

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

  const { data, error } = await supabaseAdmin.rpc('list_plans_with_store_counts');
  if (error) {
    console.error('[saas-list-plans] query failed:', error.message);
    return jsonResponse(500, { code: 'INTERNAL_ERROR', message: 'Could not load plans.' }, origin);
  }

  const plans = (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id,
    name: row.name,
    code: row.code,
    description: row.description,
    monthlyPrice: Number(row.monthly_price),
    yearlyPrice: Number(row.yearly_price),
    currencyCode: row.currency_code,
    trialDays: row.trial_days,
    maxUsers: row.max_users,
    maxBranches: row.max_branches,
    maxProducts: row.max_products,
    maxStorageMb: row.max_storage_mb,
    status: row.status,
    sortOrder: row.sort_order,
    storeCount: Number(row.store_count),
  }));

  return jsonResponse(200, { plans }, origin);
});
