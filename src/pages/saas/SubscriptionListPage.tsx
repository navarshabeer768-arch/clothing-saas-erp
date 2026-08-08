import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  PageHeader,
  Card,
  CardBody,
  Input,
  Select,
  Button,
  PageLoading,
  EmptyState,
  useToast,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
} from '../../components/ui';
import { SubscriptionStatusBadge } from '../../features/subscriptions/SubscriptionStatusBadge';
import { listSubscriptions, listPlans } from '../../features/subscriptions/subscriptionService';
import type { StoreSubscriptionListItem, SubscriptionStatus, BillingCycle } from '../../types/subscriptions';
import type { PaginationInfo } from '../../types/storeManagement';
import type { SubscriptionPlan } from '../../types/subscriptions';
import { AppError } from '../../lib/errors';

const STATUS_OPTIONS: Array<{ value: SubscriptionStatus | ''; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'trial', label: 'Trial' },
  { value: 'active', label: 'Active' },
  { value: 'expired', label: 'Expired' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'cancelled', label: 'Cancelled' },
];

const CYCLE_OPTIONS: Array<{ value: BillingCycle | ''; label: string }> = [
  { value: '', label: 'All cycles' },
  { value: 'trial', label: 'Trial' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'custom', label: 'Custom' },
];

export function SubscriptionListPage() {
  const { showToast } = useToast();
  const [subscriptions, setSubscriptions] = useState<StoreSubscriptionListItem[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [planId, setPlanId] = useState('');
  const [status, setStatus] = useState<SubscriptionStatus | ''>('');
  const [billingCycle, setBillingCycle] = useState<BillingCycle | ''>('');
  const [expiringOnly, setExpiringOnly] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    listPlans()
      .then((r) => setPlans(r.plans))
      .catch(() => undefined);
  }, []);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await listSubscriptions({
        search,
        planId: planId || undefined,
        status,
        billingCycle,
        expiringWithinDays: expiringOnly ? 30 : undefined,
        page,
        pageSize: 20,
      });
      setSubscriptions(result.subscriptions);
      setPagination(result.pagination);
    } catch (err) {
      showToast(err instanceof AppError ? err.message : 'Could not load subscriptions.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [search, planId, status, billingCycle, expiringOnly, page, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  function handleSearchSubmit(e: FormEvent) {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  const hasFilters = Boolean(search || planId || status || billingCycle || expiringOnly);

  return (
    <div>
      <PageHeader title="Subscriptions" description="Every store's current subscription, in one place." />

      <Card className="mb-4">
        <CardBody>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <form onSubmit={handleSearchSubmit} className="flex flex-1 min-w-[200px] gap-2">
              <Input placeholder="Search by store code or name" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} className="flex-1" />
              <Button type="submit" variant="secondary">
                Search
              </Button>
            </form>
            <Select value={planId} onChange={(e) => { setPlanId(e.target.value); setPage(1); }} className="sm:w-44">
              <option value="">All plans</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
            <Select value={status} onChange={(e) => { setStatus(e.target.value as SubscriptionStatus | ''); setPage(1); }} className="sm:w-40">
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
            <Select value={billingCycle} onChange={(e) => { setBillingCycle(e.target.value as BillingCycle | ''); setPage(1); }} className="sm:w-40">
              {CYCLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
            <label className="flex items-center gap-2 text-sm text-brand-700">
              <input
                type="checkbox"
                checked={expiringOnly}
                onChange={(e) => {
                  setExpiringOnly(e.target.checked);
                  setPage(1);
                }}
              />
              Expiring within 30 days
            </label>
            {hasFilters && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setSearchInput('');
                  setSearch('');
                  setPlanId('');
                  setStatus('');
                  setBillingCycle('');
                  setExpiringOnly(false);
                  setPage(1);
                }}
              >
                Clear Filters
              </Button>
            )}
          </div>
        </CardBody>
      </Card>

      {isLoading ? (
        <PageLoading label="Loading subscriptions…" />
      ) : subscriptions.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState title="No subscriptions match." />
          </CardBody>
        </Card>
      ) : (
        <>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Store</TableHeaderCell>
                <TableHeaderCell>Plan</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Billing Cycle</TableHeaderCell>
                <TableHeaderCell>Started</TableHeaderCell>
                <TableHeaderCell>Period End</TableHeaderCell>
                <TableHeaderCell>Days Remaining</TableHeaderCell>
                <TableHeaderCell></TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {subscriptions.map((s) => (
                <TableRow key={s.storeId}>
                  <TableCell>
                    <Link to={`/saas/stores/${s.storeId}`} className="font-medium text-brand-800 hover:underline">
                      {s.storeCode}
                    </Link>
                    <div className="text-xs text-brand-500">{s.businessName}</div>
                  </TableCell>
                  <TableCell>{s.planName}</TableCell>
                  <TableCell>
                    <SubscriptionStatusBadge status={s.effectiveStatus} daysRemaining={s.daysRemaining} />
                  </TableCell>
                  <TableCell className="capitalize">{s.billingCycle}</TableCell>
                  <TableCell>{new Date(s.startedAt).toLocaleDateString()}</TableCell>
                  <TableCell>{new Date(s.currentPeriodEnd).toLocaleDateString()}</TableCell>
                  <TableCell>{s.daysRemaining}</TableCell>
                  <TableCell>
                    <Link to={`/saas/stores/${s.storeId}`} className="text-xs font-medium text-brand-600 hover:underline">
                      Manage
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {pagination && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-brand-500">
                {pagination.totalCount} subscription{pagination.totalCount === 1 ? '' : 's'} · Page {pagination.page} of{' '}
                {pagination.totalPages}
              </p>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button variant="secondary" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
