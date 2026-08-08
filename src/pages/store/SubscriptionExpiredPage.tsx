import { useAuth } from '../../features/auth/AuthContext';
import { Card, CardBody, Button } from '../../components/ui';

const MESSAGES: Record<string, string> = {
  expired: 'Your store subscription has expired. Please contact the service provider.',
  suspended: 'Your store subscription is suspended. Please contact the service provider.',
  cancelled: 'Your store subscription has been cancelled. Please contact the service provider.',
};

/**
 * Shown instead of the store app when the authenticated store_user's
 * subscription is not in an accessible state (expired/suspended/cancelled).
 * Login/session checks still succeed — only business access is blocked —
 * per Phase 4 §32/§34: existing sessions are re-checked on each session
 * lookup, not just at login time.
 */
export function SubscriptionExpiredPage() {
  const { principal, store, subscription, logout } = useAuth();

  const status = subscription?.effectiveStatus ?? 'expired';
  const message = MESSAGES[status] ?? MESSAGES.expired;

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-50 px-4">
      <Card className="w-full max-w-md">
        <CardBody className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            !
          </div>
          <h1 className="mb-2 text-lg font-semibold text-brand-900">Subscription Unavailable</h1>
          <p className="mb-4 text-sm text-brand-600">{message}</p>
          {store && (
            <p className="mb-4 text-xs text-brand-400">
              {store.businessName} ({store.storeCode})
            </p>
          )}
          {principal && principal.kind === 'store_user' && subscription && (
            <p className="mb-6 text-xs text-brand-400">Plan: {subscription.planCode}</p>
          )}
          <Button variant="secondary" onClick={() => logout()}>
            Sign out
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}
