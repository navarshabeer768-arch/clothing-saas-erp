import type { ReactNode } from 'react';

/**
 * Placeholder guard for SaaS Admin routes. Same rationale as
 * ProtectedStoreRoute — Phase 2 replaces this with a real saas_admin
 * session check.
 */
export function ProtectedSaasRoute({ children }: { children: ReactNode }) {
  // TODO(Phase 2): redirect to /saas/login if there is no valid saas_admin
  // session.
  return <>{children}</>;
}
