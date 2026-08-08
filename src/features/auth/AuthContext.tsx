import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { AuthPrincipal, StoreContext, StoreUserPrincipal, SaasAdminPrincipal, SubscriptionInfo } from '../../types/auth';
import { fetchCurrentSession, logout as logoutRequest } from './authService';
import { AppError } from '../../lib/errors';

interface AuthContextValue {
  principal: AuthPrincipal;
  store: StoreContext | null;
  subscription: SubscriptionInfo | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  /** Re-checks the session against the server. Call after login. */
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  /** True if the current store_user principal has the given permission key.
   *  Always false for a SaaS admin principal or when unauthenticated.
   *  UI-ONLY CONVENIENCE — see PermissionGuard.tsx for why this can never
   *  replace backend permission checks. */
  hasPermission: (permissionKey: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [principal, setPrincipal] = useState<AuthPrincipal>(null);
  const [store, setStore] = useState<StoreContext | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const session = await fetchCurrentSession();
      if (session.kind === 'store_user') {
        const storeUser: StoreUserPrincipal = {
          kind: 'store_user',
          id: session.user.id,
          storeId: session.store.id,
          storeCode: session.store.storeCode,
          loginId: session.user.loginId,
          fullName: session.user.fullName,
          roleId: session.user.roleId,
          permissions: session.user.permissions,
        };
        setPrincipal(storeUser);
        setStore({
          id: session.store.id,
          storeCode: session.store.storeCode,
          businessName: session.store.businessName,
        });
        setSubscription(session.subscription ?? null);
      } else {
        const saasAdmin: SaasAdminPrincipal = {
          kind: 'saas_admin',
          id: session.admin.id,
          loginId: session.admin.loginId,
          fullName: session.admin.fullName,
        };
        setPrincipal(saasAdmin);
        setStore(null);
        setSubscription(null);
      }
    } catch (error) {
      // No valid session (401) or the server is unreachable — either way,
      // we are NOT authenticated. Never assume auth from any client-side
      // cache; the session endpoint is the single source of truth.
      if (!(error instanceof AppError)) {
        console.error('[auth] unexpected error checking session:', error);
      }
      setPrincipal(null);
      setStore(null);
      setSubscription(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // On app start, always ask the server — never assume auth from
  // localStorage/sessionStorage/React state left over from a previous load.
  useEffect(() => {
    refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } finally {
      // Clear frontend state regardless of whether the network call
      // succeeded — the user should never be stuck "logged in" in the UI
      // just because a logout request failed to reach the server.
      setPrincipal(null);
      setStore(null);
      setSubscription(null);
    }
  }, []);

  const hasPermission = useCallback(
    (permissionKey: string) => {
      if (!principal || principal.kind !== 'store_user') return false;
      return principal.permissions.includes(permissionKey);
    },
    [principal]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      principal,
      store,
      subscription,
      isAuthenticated: principal !== null,
      isLoading,
      refresh,
      logout,
      hasPermission,
    }),
    [principal, store, subscription, isLoading, refresh, logout, hasPermission]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
