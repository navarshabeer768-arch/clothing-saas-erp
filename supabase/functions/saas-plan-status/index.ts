// SERVER-ONLY (Deno Edge Function runtime).
// POST /functions/v1/saas-plan-status
// Body: { planId: string, newStatus: 'active' | 'inactive' | 'archived' }
//
// SaaS Admin only. Archived/inactive plans cannot be assigned to new
// stores (enforced by saas-create-store / saas-change-store-plan checking
// plan status), but existing store_subscriptions rows referencing them
// remain valid — no cascade, no data loss.

import { supabaseAdmin } from '../_shared/db.ts';
import { requireSaasAdminSession, authErrorResponse } from '../_shared/authMiddleware.ts';
import { handlePreflight } from '../_shared/cors.ts';
import { jsonResponse, isValidUuid } from '../_shared/saasHelpers.ts';
import { writeAuditLog } from '../_shared/audit.ts';
import { clientIp } from '../_shared/rateLimit.ts';

const VALID_PLAN_STATUSES = ['active', 'inactive', 'archived'];

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

  let payload: { planId?: string; newStatus?: string };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse(400, { code: 'BAD_REQUEST', message: 'Invalid request body.' }, origin);
  }

  if (!isValidUuid(payload.planId) || !payload.newStatus || !VALID_PLAN_STATUSES.includes(payload.newStatus)) {
    return jsonResponse(400, { code: 'BAD_REQUEST', message: 'A valid planId and newStatus are required.' }, origin);
  }

  const { data: plan } = await supabaseAdmin.from('subscription_plans').select('id, status, code').eq('id', payload.planId).maybeSingle();
  if (!plan) {
    return jsonResponse(404, { code: 'PLAN_NOT_FOUND', message: 'Plan not found.' }, origin);
  }

  const { error } = await supabaseAdmin.from('subscription_plans').update({ status: payload.newStatus }).eq('id', payload.planId);
  if (error) {
    console.error('[saas-plan-status] update failed:', error.message);
    return jsonResponse(500, { code: 'INTERNAL_ERROR', message: 'Could not update plan status.' }, origin);
  }

  await writeAuditLog({
    saasAdminId,
    module: 'saas_plan_management',
    action: payload.newStatus === 'archived' ? 'plan_archived' : 'plan_updated',
    entityType: 'subscription_plan',
    entityId: payload.planId,
    ipAddress: ip,
    oldValues: { status: plan.status },
    newValues: { status: payload.newStatus },
  });

  return jsonResponse(200, { success: true, status: payload.newStatus }, origin);
});
