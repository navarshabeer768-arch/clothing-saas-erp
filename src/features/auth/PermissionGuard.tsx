import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';

export interface PermissionGuardProps {
  permission: string;
  children: ReactNode;
  /** Rendered instead when the permission is missing. Defaults to nothing. */
  fallback?: ReactNode;
}

/**
 * Conditionally renders children based on the current store_user's
 * permissions.
 *
 * ⚠️ UI CONVENIENCE ONLY — NOT A SECURITY BOUNDARY. Hiding a button here
 * only improves the experience for legitimate users; it does nothing to
 * stop someone from calling the underlying Edge Function directly with
 * dev tools. Every privileged backend endpoint MUST independently call
 * `requirePermission()` (see supabase/functions/_shared/authMiddleware.ts)
 * before performing the action — this component and that check are
 * separate layers, and removing/bypassing this component must never be
 * treated as a way to grant access.
 *
 * Usage:
 *   <PermissionGuard permission="users.manage">
 *     <Button>Manage Users</Button>
 *   </PermissionGuard>
 */
export function PermissionGuard({ permission, children, fallback = null }: PermissionGuardProps) {
  const { hasPermission } = useAuth();
  return hasPermission(permission) ? <>{children}</> : <>{fallback}</>;
}
