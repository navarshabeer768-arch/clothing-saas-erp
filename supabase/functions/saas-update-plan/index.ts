// SERVER-ONLY (Deno Edge Function runtime).
// PATCH /functions/v1/saas-update-plan?id=<uuid>
//
// SaaS Admin only. Explicit field whitelist, same pattern as
// saas-update-store.

import { supabaseAdmin } from '../_shared/db.ts';
import { requireSaasAdminSession, authErrorResponse } from '../_shared/authMiddleware.ts';
import { handlePreflight } from '../_shared/cors.ts';
import { jsonResponse, isValidUuid } from '../_shared/saasHelpers.ts';
import { writeAuditLog } from '../_shared/audit.ts';
import { clientIp } from '../_shared/rateLimit.ts';

const EDITABLE_FIELDS = [
  'name',
  'description',
  'monthlyPrice',
  'yearlyPrice',
  'trialDays',
  'maxUsers',
  'maxBranches',
  'maxProducts',
  'maxStorageMb',
  'sortOrder',
] as const;

const FIELD_TO_COLUMN: Record<(typeof EDITABLE_FIELDS)[number], string> = {
  name: 'name',
  description: 'description',
  monthlyPrice: 'monthly_price',
  yearlyPrice: 'yearly_price',
  trialDays: 'trial_days',
  maxUsers: 'max_users',
  maxBranches: 'max_branches',
  maxProducts: 'max_products',
  maxStorageMb: 'max_storage_mb',
  sortOrder: 'sort_order',
};

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  const origin = req.headers.get('origin');
  const ip = clientIp(req);

  if (req.method !== 'PATCH') {
    return jsonResponse(405, { code: 'METHOD_NOT_ALLOWED', message: 'Use PATCH.' }, origin);
  }

  let saasAdminId: string;
  try {
    const context = await requireSaasAdminSession(req);
    saasAdminId = context.saasAdminId;
  } catch (error) {
    const { status, body } = authErrorResponse(error);
    return jsonResponse(status, body, origin);
  }

  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!isValidUuid(id)) {
    return jsonResponse(400, { code: 'BAD_REQUEST', message: 'A valid plan id is required.' }, origin);
  }

  let payload: Record<string, unknown> & {
    features?: Array<{ featureKey: string; enabled: boolean; limitValue?: number | null }>;
  };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse(400, { code: 'BAD_REQUEST', message: 'Invalid request body.' }, origin);
  }

  const { data: existing } = await supabaseAdmin.from('subscription_plans').select('*').eq('id', id).maybeSingle();
  if (!existing) {
    return jsonResponse(404, { code: 'PLAN_NOT_FOUND', message: 'Plan not found.' }, origin);
  }

  const updates: Record<string, unknown> = {};
  for (const field of EDITABLE_FIELDS) {
    if (field in payload) {
      updates[FIELD_TO_COLUMN[field]] = payload[field];
    }
  }

  if (Object.keys(updates).length > 0) {
    const { error } = await supabaseAdmin.from('subscription_plans').update(updates).eq('id', id);
    if (error) {
      console.error('[saas-update-plan] update failed:', error.message);
      return jsonResponse(500, { code: 'INTERNAL_ERROR', message: 'Could not update the plan.' }, origin);
    }
  }

  if (payload.features) {
    for (const f of payload.features) {
      await supabaseAdmin
        .from('plan_features')
        .upsert(
          { plan_id: id, feature_key: f.featureKey, enabled: f.enabled, limit_value: f.limitValue ?? null },
          { onConflict: 'plan_id,feature_key' }
        );
    }
  }

  await writeAuditLog({
    saasAdminId,
    module: 'saas_plan_management',
    action: 'plan_updated',
    entityType: 'subscription_plan',
    entityId: id,
    ipAddress: ip,
    oldValues: existing,
    newValues: updates,
  });

  return jsonResponse(200, { success: true }, origin);
});
