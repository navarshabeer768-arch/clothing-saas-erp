/**
 * Phase 1 domain types — hand-written to mirror supabase/migrations/*.sql.
 *
 * If you regenerate types from the live schema later (see docs/ARCHITECTURE.md
 * § Database Types), reconcile any drift against this file rather than
 * silently replacing it, since these types intentionally model only the
 * client-safe shape of each row (e.g. password_hash is typed as `never`
 * exposed to the browser is avoided entirely — see the Row types below).
 */

export type UUID = string;
export type ISODateTime = string;

// ---------------------------------------------------------------------------
// Enums / literal unions
// ---------------------------------------------------------------------------

export type SaasAdminStatus = 'active' | 'disabled';

export type StoreStatus = 'active' | 'suspended' | 'inactive' | 'archived';

export type StoreUserStatus = 'active' | 'disabled' | 'locked';

export type RoleStatus = 'active' | 'disabled';

export type SessionType = 'store_user' | 'saas_admin';

// ---------------------------------------------------------------------------
// saas_admins
// ---------------------------------------------------------------------------

export interface SaasAdmin {
  id: UUID;
  login_id: string;
  full_name: string;
  phone: string | null;
  status: SaasAdminStatus;
  last_login_at: ISODateTime | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
  // password_hash intentionally omitted — this type represents what the
  // frontend/server API is allowed to see. Never select password_hash into
  // a payload sent to the browser.
}

// ---------------------------------------------------------------------------
// stores
// ---------------------------------------------------------------------------

export interface Store {
  id: UUID;
  store_code: string;
  business_name: string;
  legal_name: string | null;
  owner_name: string;
  mobile: string;
  whatsapp: string | null;
  email: string | null;
  address_line_1: string;
  address_line_2: string | null;
  city: string | null;
  state: string | null;
  country: string;
  postal_code: string | null;
  currency_code: string;
  timezone: string;
  tax_number: string | null;
  logo_url: string | null;
  status: StoreStatus;
  created_by: UUID | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

// ---------------------------------------------------------------------------
// roles / permissions
// ---------------------------------------------------------------------------

export interface Role {
  id: UUID;
  store_id: UUID | null;
  name: string;
  description: string | null;
  is_system_role: boolean;
  status: RoleStatus;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface Permission {
  id: UUID;
  permission_key: string;
  module: string;
  action: string;
  description: string | null;
  created_at: ISODateTime;
}

export interface RolePermission {
  id: UUID;
  role_id: UUID;
  permission_id: UUID;
  created_at: ISODateTime;
}

// ---------------------------------------------------------------------------
// store_users
// ---------------------------------------------------------------------------

export interface StoreUser {
  id: UUID;
  store_id: UUID;
  login_id: string;
  full_name: string;
  phone: string | null;
  role_id: UUID | null;
  status: StoreUserStatus;
  failed_login_attempts: number;
  locked_until: ISODateTime | null;
  password_changed_at: ISODateTime;
  last_login_at: ISODateTime | null;
  created_by: UUID | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

// ---------------------------------------------------------------------------
// sessions (client-visible shape only — token_hash never leaves the server)
// ---------------------------------------------------------------------------

export interface SessionSummary {
  id: UUID;
  session_type: SessionType;
  created_at: ISODateTime;
  expires_at: ISODateTime;
  last_activity_at: ISODateTime;
  ip_address: string | null;
  device_name: string | null;
}

// ---------------------------------------------------------------------------
// settings
// ---------------------------------------------------------------------------

export interface StoreSetting<TValue = Record<string, unknown>> {
  id: UUID;
  store_id: UUID;
  setting_key: string;
  setting_value: TValue;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface SaasSetting<TValue = Record<string, unknown>> {
  id: UUID;
  setting_key: string;
  setting_value: TValue;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

// ---------------------------------------------------------------------------
// audit_logs
// ---------------------------------------------------------------------------

export interface AuditLog {
  id: UUID;
  store_id: UUID | null;
  saas_admin_id: UUID | null;
  store_user_id: UUID | null;
  module: string;
  action: string;
  entity_type: string | null;
  entity_id: UUID | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: ISODateTime;
}
