import { PageHeader, Card, CardBody, Badge } from '../../components/ui';
import { useAuth } from '../../features/auth/AuthContext';

export function SaasDashboardPage() {
  const { principal } = useAuth();

  if (!principal || principal.kind !== 'saas_admin') return null;

  return (
    <div>
      <PageHeader title={`Welcome, ${principal.fullName}`} description="SaaS Platform Administration" />
      <Card>
        <CardBody>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-brand-400">Logged in as</dt>
              <dd className="mt-1 text-sm font-medium text-brand-900">{principal.loginId}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-brand-400">Phase status</dt>
              <dd className="mt-1">
                <Badge tone="success">Phase 2 -- Authentication &amp; Sessions complete</Badge>
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-sm text-brand-500">
            Store management, subscriptions, and plans are built in Phase 3.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
