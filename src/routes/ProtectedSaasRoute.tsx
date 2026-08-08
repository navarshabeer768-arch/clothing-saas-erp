import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../features/auth';
import { PageLoading } from '../components/ui';

/**
 * Guards /saas/* routes. Requires an authenticated saas_admin session. A
 * store_user who is authenticated but not a saas_admin is redirected to
 * /saas/login, not /login — store-user sessions never grant SaaS access.
 */
export function ProtectedSaasRoute({ children }: { children: ReactNode }) {
  const { principal, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <PageLoading label="Checking your session…" />;
  }

  if (!principal || principal.kind !== 'saas_admin') {
    return <Navigate to="/saas/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
