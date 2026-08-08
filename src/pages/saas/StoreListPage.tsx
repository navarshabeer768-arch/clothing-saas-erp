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
  Dialog,
  EmptyState,
  PageLoading,
  useToast,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
  Dropdown,
} from '../../components/ui';
import { StoreStatusBadge } from '../../features/store-management/StoreStatusBadge';
import { listStores, changeStoreStatus } from '../../features/store-management/storeManagementService';
import type { StoreListItem, PaginationInfo } from '../../types/storeManagement';
import type { StoreStatus } from '../../types/database';
import { AppError } from '../../lib/errors';

const STATUS_OPTIONS: Array<{ value: StoreStatus | ''; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'archived', label: 'Archived' },
];

type PendingAction = { store: StoreListItem; newStatus: StoreStatus } | null;

export function StoreListPage() {
  const { showToast } = useToast();

  const [stores, setStores] = useState<StoreListItem[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StoreStatus | ''>('');
  const [country, setCountry] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await listStores({ search, status, country, page, pageSize });
      setStores(result.stores);
      setPagination(result.pagination);
    } catch (err) {
      showToast(err instanceof AppError ? err.message : 'Could not load stores.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [search, status, country, page, pageSize, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  function handleSearchSubmit(e: FormEvent) {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  function handleClearFilters() {
    setSearchInput('');
    setSearch('');
    setStatus('');
    setCountry('');
    setPage(1);
  }

  async function confirmStatusChange() {
    if (!pendingAction) return;
    setIsSubmittingAction(true);
    try {
      const result = await changeStoreStatus({ storeId: pendingAction.store.id, newStatus: pendingAction.newStatus });
      showToast(
        result.revokedSessionCount > 0
          ? `Store status updated. ${result.revokedSessionCount} active session(s) revoked.`
          : 'Store status updated.',
        'success'
      );
      setPendingAction(null);
      await load();
    } catch (err) {
      showToast(err instanceof AppError ? err.message : 'Could not update store status.', 'error');
    } finally {
      setIsSubmittingAction(false);
    }
  }

  const hasFilters = Boolean(search || status || country);

  return (
    <div>
      <PageHeader
        title="Stores"
        description="Manage every store on the platform."
        actions={
          <Link to="/saas/stores/new">
            <Button>+ Add Store</Button>
          </Link>
        }
      />

      <Card className="mb-4">
        <CardBody>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:flex-wrap">
            <form onSubmit={handleSearchSubmit} className="flex flex-1 min-w-[220px] gap-2">
              <Input
                placeholder="Search by store code, business, owner, mobile, or email"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="flex-1"
              />
              <Button type="submit" variant="secondary">
                Search
              </Button>
            </form>
            <Select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as StoreStatus | '');
                setPage(1);
              }}
              className="sm:w-44"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
            <Input
              placeholder="Country"
              value={country}
              onChange={(e) => {
                setCountry(e.target.value);
                setPage(1);
              }}
              className="sm:w-40"
            />
            {hasFilters && (
              <Button type="button" variant="ghost" onClick={handleClearFilters}>
                Clear Filters
              </Button>
            )}
          </div>
        </CardBody>
      </Card>

      {isLoading ? (
        <PageLoading label="Loading stores…" />
      ) : stores.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              title={hasFilters ? 'No stores match your filters.' : 'No stores have been created yet.'}
              action={
                !hasFilters ? (
                  <Link to="/saas/stores/new">
                    <Button>Add Store</Button>
                  </Link>
                ) : undefined
              }
            />
          </CardBody>
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Store</TableHeaderCell>
                  <TableHeaderCell>Owner</TableHeaderCell>
                  <TableHeaderCell>Mobile</TableHeaderCell>
                  <TableHeaderCell>Country</TableHeaderCell>
                  <TableHeaderCell>Users</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                  <TableHeaderCell>Created</TableHeaderCell>
                  <TableHeaderCell></TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {stores.map((store) => (
                  <StoreRow key={store.id} store={store} onRequestStatusChange={setPendingAction} />
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <div className="flex flex-col gap-3 md:hidden">
            {stores.map((store) => (
              <StoreCard key={store.id} store={store} onRequestStatusChange={setPendingAction} />
            ))}
          </div>

          {pagination && (
            <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
              <p className="text-sm text-brand-500">
                {pagination.totalCount} store{pagination.totalCount === 1 ? '' : 's'} · Page {pagination.page} of{' '}
                {pagination.totalPages}
              </p>
              <div className="flex items-center gap-2">
                <Select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="w-28"
                >
                  <option value={20}>20 / page</option>
                  <option value={50}>50 / page</option>
                  <option value={100}>100 / page</option>
                </Select>
                <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <Dialog
        open={pendingAction !== null}
        onClose={() => setPendingAction(null)}
        title="Confirm status change"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setPendingAction(null)} disabled={isSubmittingAction}>
              Cancel
            </Button>
            <Button
              variant={
                pendingAction?.newStatus === 'archived' || pendingAction?.newStatus === 'suspended' ? 'danger' : 'primary'
              }
              isLoading={isSubmittingAction}
              onClick={confirmStatusChange}
            >
              Confirm
            </Button>
          </div>
        }
      >
        {pendingAction && (
          <p className="text-sm text-brand-600">
            {pendingAction.newStatus === 'suspended' &&
              `Suspend ${pendingAction.store.storeCode}? Users from this store will no longer be able to sign in, and their active sessions will be revoked immediately.`}
            {pendingAction.newStatus === 'archived' &&
              `Archive ${pendingAction.store.storeCode}? This store will be hidden from the active store list and users will no longer be able to sign in. Data is not deleted.`}
            {pendingAction.newStatus === 'active' &&
              `Reactivate ${pendingAction.store.storeCode}? Users with active accounts will be able to sign in again.`}
            {pendingAction.newStatus === 'inactive' && `Mark ${pendingAction.store.storeCode} as inactive?`}
          </p>
        )}
      </Dialog>
    </div>
  );
}

function statusActions(store: StoreListItem, onRequest: (a: PendingAction) => void) {
  const items: Array<{ label: string; onSelect: () => void; danger?: boolean }> = [];
  if (store.status !== 'active') {
    items.push({ label: 'Activate', onSelect: () => onRequest({ store, newStatus: 'active' }) });
  }
  if (store.status === 'active') {
    items.push({ label: 'Suspend', onSelect: () => onRequest({ store, newStatus: 'suspended' }), danger: true });
  }
  if (store.status !== 'archived') {
    items.push({ label: 'Archive', onSelect: () => onRequest({ store, newStatus: 'archived' }), danger: true });
  }
  return items;
}

function StoreRow({
  store,
  onRequestStatusChange,
}: {
  store: StoreListItem;
  onRequestStatusChange: (a: PendingAction) => void;
}) {
  return (
    <TableRow>
      <TableCell>
        <Link to={`/saas/stores/${store.id}`} className="font-medium text-brand-800 hover:underline">
          {store.storeCode}
        </Link>
        <div className="text-xs text-brand-500">{store.businessName}</div>
      </TableCell>
      <TableCell>{store.ownerName}</TableCell>
      <TableCell>{store.mobile}</TableCell>
      <TableCell>{store.country}</TableCell>
      <TableCell>{store.userCount}</TableCell>
      <TableCell>
        <StoreStatusBadge status={store.status} />
      </TableCell>
      <TableCell>{new Date(store.createdAt).toLocaleDateString()}</TableCell>
      <TableCell>
        <Dropdown
          trigger={<span className="cursor-pointer px-2 text-brand-500">⋯</span>}
          items={statusActions(store, onRequestStatusChange)}
        />
      </TableCell>
    </TableRow>
  );
}

function StoreCard({
  store,
  onRequestStatusChange,
}: {
  store: StoreListItem;
  onRequestStatusChange: (a: PendingAction) => void;
}) {
  return (
    <Card>
      <CardBody>
        <div className="flex items-start justify-between">
          <div>
            <Link to={`/saas/stores/${store.id}`} className="font-medium text-brand-800 hover:underline">
              {store.storeCode}
            </Link>
            <div className="text-sm text-brand-600">{store.businessName}</div>
          </div>
          <StoreStatusBadge status={store.status} />
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-brand-500">
          <div>
            <dt className="uppercase tracking-wide">Owner</dt>
            <dd className="text-brand-800">{store.ownerName}</dd>
          </div>
          <div>
            <dt className="uppercase tracking-wide">Mobile</dt>
            <dd className="text-brand-800">{store.mobile}</dd>
          </div>
          <div>
            <dt className="uppercase tracking-wide">Country</dt>
            <dd className="text-brand-800">{store.country}</dd>
          </div>
          <div>
            <dt className="uppercase tracking-wide">Users</dt>
            <dd className="text-brand-800">{store.userCount}</dd>
          </div>
        </dl>
        <div className="mt-3 flex flex-wrap gap-2">
          {statusActions(store, onRequestStatusChange).map((action) => (
            <Button key={action.label} size="sm" variant={action.danger ? 'danger' : 'secondary'} onClick={action.onSelect}>
              {action.label}
            </Button>
          ))}
          <Link to={`/saas/stores/${store.id}`}>
            <Button size="sm" variant="ghost">
              View
            </Button>
          </Link>
        </div>
      </CardBody>
    </Card>
  );
}
