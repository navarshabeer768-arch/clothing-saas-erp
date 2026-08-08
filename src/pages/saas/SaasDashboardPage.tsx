import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader, Card, CardBody, CardHeader, PageLoading, useToast } from '../../components/ui';
import { StoreStatusBadge } from '../../features/store-management/StoreStatusBadge';
import { getSaasDashboardSummary } from '../../features/store-management/storeManagementService';
import type { SaasDashboardResponse } from '../../types/storeManagement';
import { useAuth } from '../../features/auth/AuthContext';
import { AppError } from '../../lib/errors';

export function SaasDashboardPage() {
  const { principal } = useAuth();
  const { showToast } = useToast();
  const [data, setData] = useState<SaasDashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await getSaasDashboardSummary();
        if (!cancelled) setData(result);
      } catch (err) {
        showToast(err instanceof AppError ? err.message : 'Could not load dashboard data.', 'error');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!principal || principal.kind !== 'saas_admin') return null;

  return (
    <div>
      <PageHeader title={`Welcome, ${principal.fullName}`} description="SaaS Platform Administration" />

      {isLoading ? (
        <PageLoading label="Loading dashboard…" />
      ) : data ? (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <StatCard label="Total Stores" value={data.summary.totalStores} />
            <StatCard label="Active" value={data.summary.activeStores} tone="success" />
            <StatCard label="Suspended" value={data.summary.suspendedStores} tone="warning" />
            <StatCard label="Archived" value={data.summary.archivedStores} tone="danger" />
            <StatCard label="Total Store Users" value={data.summary.totalStoreUsers} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-brand-800">Recently Added Stores</h2>
                <Link to="/saas/stores" className="text-xs font-medium text-brand-600 hover:underline">
                  View All Stores
                </Link>
              </CardHeader>
              <CardBody>
                {data.recentStores.length === 0 ? (
                  <p className="text-sm text-brand-400">No stores yet.</p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {data.recentStores.map((s) => (
                      <li key={s.id} className="flex items-center justify-between">
                        <div>
                          <Link to={`/saas/stores/${s.id}`} className="text-sm font-medium text-brand-800 hover:underline">
                            {s.storeCode}
                          </Link>
                          <p className="text-xs text-brand-500">
                            {s.businessName} · {s.ownerName}
                          </p>
                        </div>
                        <StoreStatusBadge status={s.status} />
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <h2 className="text-sm font-semibold text-brand-800">Recent SaaS Activity</h2>
              </CardHeader>
              <CardBody>
                {data.recentActivity.length === 0 ? (
                  <p className="text-sm text-brand-400">No activity yet.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {data.recentActivity.map((a) => (
                      <li key={a.id} className="flex items-center justify-between border-b border-brand-100 pb-2 last:border-0">
                        <span className="text-sm text-brand-800">{a.action.replace(/_/g, ' ')}</span>
                        <span className="text-xs text-brand-400">{new Date(a.createdAt).toLocaleString()}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: 'success' | 'warning' | 'danger' }) {
  const toneTextClass = tone === 'success' ? 'text-emerald-600' : tone === 'warning' ? 'text-amber-600' : tone === 'danger' ? 'text-red-600' : 'text-brand-900';
  return (
    <Card>
      <CardBody>
        <p className="text-xs font-medium uppercase tracking-wide text-brand-400">{label}</p>
        <p className={`mt-1 text-2xl font-semibold ${toneTextClass}`}>{value}</p>
      </CardBody>
    </Card>
  );
}
