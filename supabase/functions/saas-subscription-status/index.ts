// SERVER-ONLY (Deno Edge Function runtime).
// POST /functions/v1/saas-subscription-status
// Body: { storeId, newStatus: 'trial' | 'active' | 'expired' | 'suspended' | 'cancelled', notes? }
//
// SaaS Admin only. Changes the SUBSCRIPTION's status — distinct from
// saas-store-status, which changes the STORE's own status. A store can
// remain 'active' while its subscription is 'suspended' or 'cancelled';
// the two are never conflated (Phase 4 §33).

import { supabaseAdmin } from '../_shared/db.ts';
import { requireSaasAdminSession, authErrorResponse } from '../_shared/authMiddleware.ts';
import { handlePreflight } from '../_shared/cors.ts';
import { jsonResponse, isValidUuid } from '../_shared/saasHelpers.ts';

const VALID_STATUSES = ['trial', 'active', 'expired', 'suspended', 'cancelled'];

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

  let payload: { storeId?: string; newStatus?: string; notes?: string };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse(400, { code: 'BAD_REQUEST', message: 'Invalid request body.' }, origin);
  }

  if (!isValidUuid(payload.storeId) || !payload.newStatus || !VALID_STATUSES.includes(payload.newStatus)) {
    return jsonResponse(400, { code: 'BAD_REQUEST', message: 'A valid storeId and newStatus are required.' }, origin);
  }

  const { data: subscriptionId, error } = await supabaseAdmin.rpc('set_subscription_status', {
    p_store_id: payload.storeId,
    p_new_status: payload.newStatus,
    p_saas_admin_id: saasAdminId,
    p_notes: payload.notes ?? null,
  });

  if (error) {
    if (error.message?.includes('no subscription')) {
      return jsonResponse(404, { code: 'SUBSCRIPTION_NOT_FOUND', message: 'This store has no subscription.' }, origin);
    }
    console.error('[saas-subscription-status] failed:', error.message);
    return jsonResponse(500, { code: 'INTERNAL_ERROR', message: 'Could not update subscription status.' }, origin);
  }

  return jsonResponse(200, { success: true, subscriptionId, status: payload.newStatus }, origin);
});
