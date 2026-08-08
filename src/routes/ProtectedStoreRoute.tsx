import type { ReactNode } from 'react';

/**
 * Placeholder guard for store-app routes that require an authenticated
 * store_user session. Phase 1 has no real auth yet, so this currently just
 * renders its children — Phase 2 will replace the body with a real check
 * against the session established via the trusted server API (never trust
 * a store_id read from the URL/localStorage; always re-derive it from the
 * verified session token). Keeping this component in place now means every
 * future protected route already routes through a single, easy-to-harden
 * choke point.
 */
export function ProtectedStoreRoute({ children }: { children: ReactNode }) {
  // TODO(Phase 2): redirect to /login if there is no valid store_user
  // session, and expose the resolved StoreUserPrincipal via context.
  return <>{children}</>;
}
