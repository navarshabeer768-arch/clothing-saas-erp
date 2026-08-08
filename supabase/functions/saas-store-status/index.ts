// SERVER-ONLY (Deno Edge Function runtime).
// POST /functions/v1/saas-store-status
// Body: { storeId: string, newStatus: 'active' | 'suspended' | 'inactive' | 'archived' }
//
// SaaS Admin only. Delegates to set_store_status() (see
// supabase/migrations/0014_store_management_functions.sql), which updates
// the status, revokes every active session for that store whenever it
// leaves 'active' status, and writes the audit trail — all atomically, so
// "suspended but sessions still valid" can never happen as an inconsistent
// partial state.

import { supabaseAdmin } from '../_shared/db.ts';
import { requireSaasAdminSession, authErrorResponse } from '../_shared/authMiddleware.ts';
import { handlePreflight } from '../_shared/cors.ts';
import { jsonResponse, isValidUuid, isValidStoreStatus } from '../_shared/saasHelpers.ts';

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

  let payload: { storeId?: string; newStatus?: string };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse(400, { code: 'BAD_REQUEST', message: 'Invalid request body.' }, origin);
  }

  if (!isValidUuid(payload.storeId)) {
    return jsonResponse(400, { code: 'BAD_REQUEST', message: 'A valid storeId is required.' }, origin);
  }
  if (!isValidStoreStatus(payload.newStatus)) {
    return jsonResponse(400, { code: 'BAD_REQUEST', message: 'newStatus must be one of active, suspended, inactive, archived.' }, origin);
  }

  const { data: store } = await supabaseAdmin.from('stores').select('id').eq('id', payload.storeId).maybeSingle();
  if (!store) {
    return jsonResponse(404, { code: 'STORE_NOT_FOUND', message: 'Store not found.' }, origin);
  }

  const { data, error } = await supabaseAdmin.rpc('set_store_status', {
    p_store_id: payload.storeId,
    p_new_status: payload.newStatus,
    p_saas_admin_id: saasAdminId,
  });

  if (error) {
    console.error('[saas-store-status] failed:', error.message);
    return jsonResponse(500, { code: 'INTERNAL_ERROR', message: 'Could not update store status. Please try again.' }, origin);
  }

  const result = Array.isArray(data) ? data[0] : data;

  return jsonResponse(
    200,
    {
      success: true,
      status: payload.newStatus,
      revokedSessionCount: result?.revoked_session_count ?? 0,
    },
    origin
  );
});
