import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../features/auth';
import { PageLoading } from '../components/ui';

/**
 * Guards /app/* routes. Requires an authenticated store_user session
 * (resolved by AuthProvider via the server session-me endpoint -- never
 * inferred from localStorage or React state alone). A SaaS admin who is
 * authenticated but not a store_user is also redirected to /login.
 *
 * Phase 4: also enforces subscription access. A valid session with an
 * expired/suspended/cancelled subscription is redirected to
 * /subscription-expired instead of the app -- the login/session itself
 * still succeeds (so the user can see why they're blocked), only business
 * access is withheld, per Phase 4 §32/§34.
 */
export function ProtectedStoreRoute({ children }: { children: ReactNode }) {
  const { principal, isLoading, subscription } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <PageLoading label="Checking your session…" />;
  }

  if (!principal || principal.kind !== 'store_user') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (subscription && ['expired', 'suspended', 'cancelled'].includes(subscription.effectiveStatus)) {
    return <Navigate to="/subscription-expired" replace />;
  }

  return <>{children}</>;
}
