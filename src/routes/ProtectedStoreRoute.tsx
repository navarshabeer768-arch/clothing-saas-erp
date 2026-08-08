import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../features/auth';
import { PageLoading } from '../components/ui';

/**
 * Guards /app/* routes. Requires an authenticated store_user session
 * (resolved by AuthProvider via the server session-me endpoint — never
 * inferred from localStorage or React state alone). A SaaS admin who is
 * authenticated but not a store_user is also redirected to /login, since
 * SaaS admin sessions must not grant access to store routes.
 */
export function ProtectedStoreRoute({ children }: { children: ReactNode }) {
  const { principal, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <PageLoading label="Checking your session…" />;
  }

  if (!principal || principal.kind !== 'store_user') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
