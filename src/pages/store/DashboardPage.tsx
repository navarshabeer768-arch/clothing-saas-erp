import { PageHeader, Card, CardBody, Badge } from '../../components/ui';
import { useAuth } from '../../features/auth/AuthContext';

/**
 * Store dashboard placeholder. Shows real logged-in identity/store info per
 * Phase 2 scope -- no business statistics yet (those come once Sales,
 * Inventory, etc. exist in later phases).
 */
export function StoreDashboardPage() {
  const { principal, store } = useAuth();

  if (!principal || principal.kind !== 'store_user') return null;

  return (
    <div>
      <PageHeader title={`Welcome, ${principal.fullName}`} />
      <Card>
        <CardBody>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-brand-400">Store</dt>
              <dd className="mt-1 text-sm font-medium text-brand-900">{store?.businessName ?? '--'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-brand-400">Store ID</dt>
              <dd className="mt-1 text-sm font-medium text-brand-900">{store?.storeCode ?? '--'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-brand-400">Logged in as</dt>
              <dd className="mt-1 text-sm font-medium text-brand-900">{principal.loginId}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-brand-400">Permissions</dt>
              <dd className="mt-1 flex flex-wrap gap-1.5">
                {principal.permissions.length === 0 ? (
                  <span className="text-sm text-brand-400">None assigned</span>
                ) : (
                  principal.permissions.map((p) => (
                    <Badge key={p} tone="info">
                      {p}
                    </Badge>
                  ))
                )}
              </dd>
            </div>
          </dl>
        </CardBody>
      </Card>
    </div>
  );
}
