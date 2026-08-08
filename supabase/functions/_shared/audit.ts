// SERVER-ONLY (Deno Edge Function runtime). Never imported from src/.

import { supabaseAdmin } from './db.ts';

export interface AuditLogInput {
  storeId?: string | null;
  saasAdminId?: string | null;
  storeUserId?: string | null;
  module: string;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
}

/**
 * Writes an audit_logs row. Never pass plain-text passwords or password
 * hashes in `metadata` — this function does not scrub input, callers are
 * responsible for only including safe fields.
 */
export async function writeAuditLog(input: AuditLogInput): Promise<void> {
  const { error } = await supabaseAdmin.from('audit_logs').insert({
    store_id: input.storeId ?? null,
    saas_admin_id: input.saasAdminId ?? null,
    store_user_id: input.storeUserId ?? null,
    module: input.module,
    action: input.action,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    metadata: input.metadata ?? null,
    ip_address: input.ipAddress ?? null,
  });

  if (error) {
    // Audit logging failures should never break the auth flow itself, but
    // must be visible in function logs for investigation.
    console.error('[audit] failed to write audit log:', error.message, input.action);
  }
}
