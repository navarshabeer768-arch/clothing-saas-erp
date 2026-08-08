import type { StoreStatus, StoreUserStatus, SaasAdminStatus, UUID } from './database';

/**
 * Shape of the authenticated principal kept in frontend memory/context after
 * a successful login against the Phase 2 server-side auth endpoint.
 *
 * IMPORTANT: this is the ONLY place store_id should be read from for
 * rendering purposes. It must never be trusted for authorization decisions —
 * every privileged server call re-derives store_id from the verified session
 * token, not from this client-side object. See docs/ARCHITECTURE.md
 * § Tenant Isolation Strategy.
 */
export interface StoreUserPrincipal {
  kind: 'store_user';
  id: UUID;
  storeId: UUID;
  storeCode: string;
  loginId: string;
  fullName: string;
  status?: StoreUserStatus;
  roleId: UUID | null;
  permissions: string[];
}

export interface SaasAdminPrincipal {
  kind: 'saas_admin';
  id: UUID;
  loginId: string;
  fullName: string;
  status?: SaasAdminStatus;
}

export type AuthPrincipal = StoreUserPrincipal | SaasAdminPrincipal | null;

export interface StoreContext {
  id: UUID;
  storeCode: string;
  businessName: string;
  status?: StoreStatus;
  currencyCode?: string;
  timezone?: string;
  logoUrl?: string | null;
}

// ---------------------------------------------------------------------------
// Request/response contracts for the Phase 2 Edge Functions
// (supabase/functions/store-login, saas-login, session-me, ...)
// ---------------------------------------------------------------------------

export interface StoreLoginRequest {
  storeId: string;
  loginId: string;
  password: string;
}

export interface StoreLoginResponse {
  user: {
    id: UUID;
    loginId: string;
    fullName: string;
    roleId: UUID | null;
    permissions: string[];
  };
  store: {
    id: UUID;
    storeCode: string;
    businessName: string;
    currencyCode: string;
    timezone: string;
    logoUrl: string | null;
  };
  expiresAt: string;
}

export interface SaasLoginRequest {
  loginId: string;
  password: string;
}

export interface SaasLoginResponse {
  admin: {
    id: UUID;
    loginId: string;
    fullName: string;
  };
  expiresAt: string;
}

export type SessionMeResponse =
  | {
      kind: 'store_user';
      user: { id: UUID; loginId: string; fullName: string; roleId: UUID | null; permissions: string[] };
      store: { id: UUID; storeCode: string; businessName: string };
    }
  | {
      kind: 'saas_admin';
      admin: { id: UUID; loginId: string; fullName: string };
    };

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

/** Generic error shape returned by every auth endpoint. */
export interface AuthApiError {
  code: string;
  message: string;
}
