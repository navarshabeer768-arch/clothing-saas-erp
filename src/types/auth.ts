import type { StoreStatus, StoreUserStatus, SaasAdminStatus, UUID } from './database';

/**
 * Shape of the authenticated principal kept in frontend memory/context after
 * a successful login against the (Phase 2) server-side auth endpoint.
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
  status: StoreUserStatus;
  roleId: UUID | null;
  permissions: string[];
}

export interface SaasAdminPrincipal {
  kind: 'saas_admin';
  id: UUID;
  loginId: string;
  fullName: string;
  status: SaasAdminStatus;
}

export type AuthPrincipal = StoreUserPrincipal | SaasAdminPrincipal | null;

export interface StoreContext {
  id: UUID;
  storeCode: string;
  businessName: string;
  status: StoreStatus;
}

/** Result contract the Phase 2 login endpoint will return. Defined now so
 * frontend auth plumbing can be built against a stable contract. */
export interface LoginResult {
  principal: StoreUserPrincipal | SaasAdminPrincipal;
  /** Opaque bearer token. Only the hash of this is ever stored server-side. */
  token: string;
  expiresAt: string;
}
