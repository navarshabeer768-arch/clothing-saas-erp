import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  PageHeader,
  Card,
  CardBody,
  CardHeader,
  Button,
  Badge,
  Dialog,
  Input,
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
import { StoreStatusBadge } from '../../features/store-management/StoreStatusBadge';
import { StoreSubscriptionCard } from '../../features/subscriptions/StoreSubscriptionCard';
import {
  getStore,
  changeStoreStatus,
  resetStoreAdminPassword,
  updateStore,
} from '../../features/store-management/storeManagementService';
import type { StoreDetailsResponse } from '../../types/storeManagement';
import type { StoreStatus } from '../../types/database';
import { AppError } from '../../lib/errors';

type StatusDialogState = { newStatus: StoreStatus } | null;

export function StoreDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [data, setData] = useState<StoreDetailsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [statusDialog, setStatusDialog] = useState<StatusDialogState>(null);
  const [isChangingStatus, setIsChangingStatus] = useState(false);

  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setNotFound(false);
    try {
      const result = await getStore(id);
      setData(result);
      setEditForm({
        businessName: result.store.businessName,
        legalName: result.store.legalName ?? '',
        ownerName: result.store.ownerName,
        mobile: result.store.mobile,
        whatsapp: result.store.whatsapp ?? '',
        email: result.store.email ?? '',
        addressLine1: result.store.addressLine1,
        addressLine2: result.store.addressLine2 ?? '',
        city: result.store.city ?? '',
        state: result.store.state ?? '',
        country: result.store.country,
        postalCode: result.store.postalCode ?? '',
        currencyCode: result.store.currencyCode,
        timezone: result.store.timezone,
        taxNumber: result.store.taxNumber ?? '',
      });
    } catch (err) {
      if (err instanceof AppError && err.code === 'STORE_NOT_FOUND') {
        setNotFound(true);
      } else {
        showToast(err instanceof AppError ? err.message : 'Could not load store details.', 'error');
      }
    } finally {
      setIsLoading(false);
    }
  }, [id, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  async function confirmStatusChange() {
    if (!id || !statusDialog) return;
    setIsChangingStatus(true);
    try {
      const result = await changeStoreStatus({ storeId: id, newStatus: statusDialog.newStatus });
      showToast(
        result.revokedSessionCount > 0
          ? `Store status updated. ${result.revokedSessionCount} active session(s) revoked.`
          : 'Store status updated.',
        'success'
      );
      setStatusDialog(null);
      await load();
    } catch (err) {
      showToast(err instanceof AppError ? err.message : 'Could not update store status.', 'error');
    } finally {
      setIsChangingStatus(false);
    }
  }

  async function handleResetPassword(event: FormEvent) {
    event.preventDefault();
    if (!id || !data?.admin) return;
    setResetError(null);

    if (newPassword.length < 8) {
      setResetError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setResetError('Passwords do not match.');
      return;
    }

    setIsResetting(true);
    try {
      await resetStoreAdminPassword({
        storeId: id,
        storeUserId: data.admin.id,
        newPassword,
        confirmPassword,
      });
      showToast('Store Admin password reset successfully.', 'success');
      setResetDialogOpen(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setResetError(err instanceof AppError ? err.message : 'Could not reset the password.');
    } finally {
      setIsResetting(false);
    }
  }

  async function handleSaveEdit(event: FormEvent) {
    event.preventDefault();
    if (!id) return;
    setIsSavingEdit(true);
    try {
      await updateStore(id, editForm);
      showToast('Store details updated.', 'success');
      setIsEditing(false);
      await load();
    } catch (err) {
      showToast(err instanceof AppError ? err.message : 'Could not update the store.', 'error');
    } finally {
      setIsSavingEdit(false);
    }
  }

  if (isLoading) return <PageLoading label="Loading store…" />;

  if (notFound || !data) {
    return (
      <Card>
        <CardBody>
          <EmptyState title="Store not found" action={<Button onClick={() => navigate('/saas/stores')}>Back to Stores</Button>} />
        </CardBody>
      </Card>
    );
  }

  const { store, usersSummary, users, admin, usage, recentActivity } = data;

  return (
    <div>
      <PageHeader
        title={store.businessName}
        description={store.storeCode}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setIsEditing((v) => !v)}>
              {isEditing ? 'Cancel Edit' : 'Edit'}
            </Button>
            {store.status !== 'active' && (
              <Button onClick={() => setStatusDialog({ newStatus: 'active' })}>Activate</Button>
            )}
            {store.status === 'active' && (
              <Button variant="danger" onClick={() => setStatusDialog({ newStatus: 'suspended' })}>
                Suspend
              </Button>
            )}
            {store.status !== 'archived' && (
              <Button variant="danger" onClick={() => setStatusDialog({ newStatus: 'archived' })}>
                Archive
              </Button>
            )}
          </div>
        }
      />

      {isEditing ? (
        <Card className="mb-6">
          <CardHeader>
            <h2 className="text-sm font-semibold text-brand-800">Edit Business Information</h2>
          </CardHeader>
          <CardBody>
            <form onSubmit={handleSaveEdit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {(
                [
                  ['businessName', 'Business Name'],
                  ['legalName', 'Legal Name'],
                  ['ownerName', 'Owner Name'],
                  ['mobile', 'Mobile'],
                  ['whatsapp', 'WhatsApp'],
                  ['email', 'Email'],
                  ['addressLine1', 'Address Line 1'],
                  ['addressLine2', 'Address Line 2'],
                  ['city', 'City'],
                  ['state', 'State/Province'],
                  ['country', 'Country'],
                  ['postalCode', 'Postal Code'],
                  ['currencyCode', 'Currency Code'],
                  ['timezone', 'Timezone'],
                  ['taxNumber', 'Tax Number'],
                ] as const
              ).map(([key, label]) => (
                <Input
                  key={key}
                  label={label}
                  value={editForm[key] ?? ''}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, [key]: e.target.value }))}
                />
              ))}
              <div className="sm:col-span-2 flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
                <Button type="submit" isLoading={isSavingEdit}>
                  Save Changes
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      ) : (
        <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-brand-800">Business Information</h2>
            </CardHeader>
            <CardBody>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Field label="Store Code" value={store.storeCode} />
                <Field label="Legal Name" value={store.legalName ?? '—'} />
                <Field label="Owner" value={store.ownerName} />
                <Field label="Mobile" value={store.mobile} />
                <Field label="WhatsApp" value={store.whatsapp ?? '—'} />
                <Field label="Email" value={store.email ?? '—'} />
                <Field label="Address" value={[store.addressLine1, store.addressLine2, store.city, store.state].filter(Boolean).join(', ')} />
                <Field label="Country" value={store.country} />
                <Field label="Currency" value={store.currencyCode} />
                <Field label="Timezone" value={store.timezone} />
                <Field label="Tax Number" value={store.taxNumber ?? '—'} />
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-brand-800">Account</h2>
            </CardHeader>
            <CardBody>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-brand-400">Status</dt>
                  <dd className="mt-1">
                    <StoreStatusBadge status={store.status} />
                  </dd>
                </div>
                <Field label="Created" value={new Date(store.createdAt).toLocaleString()} />
                <Field label="Last Updated" value={new Date(store.updatedAt).toLocaleString()} />
              </dl>

              <h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-brand-400">Users Summary</h3>
              <div className="flex gap-4 text-sm">
                <Badge tone="neutral">{usersSummary.totalUsers} total</Badge>
                <Badge tone="success">{usersSummary.activeUsers} active</Badge>
                <Badge tone="warning">{usersSummary.disabledUsers} disabled</Badge>
              </div>

              <h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-brand-400">Usage</h3>
              <div className="flex gap-4 text-sm text-brand-700">
                <span>{usage.userCount} users</span>
                <span>{usage.auditActivityCount} audit events</span>
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {admin && (
        <Card className="mb-6">
          <CardHeader className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-brand-800">Store Admin</h2>
            <Button size="sm" variant="secondary" onClick={() => setResetDialogOpen(true)}>
              Reset Store Admin Password
            </Button>
          </CardHeader>
          <CardBody>
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <Field label="Name" value={admin.fullName} />
              <Field label="Login ID" value={admin.loginId} />
              <Field label="Status" value={admin.status} />
              <Field label="Last Login" value={admin.lastLoginAt ? new Date(admin.lastLoginAt).toLocaleString() : 'Never'} />
            </dl>
          </CardBody>
        </Card>
      )}

      {store && <StoreSubscriptionCard storeId={store.id} />}

      <Card className="mb-6">
        <CardHeader>
          <h2 className="text-sm font-semibold text-brand-800">Store Users</h2>
        </CardHeader>
        <CardBody>
          {users.length === 0 ? (
            <EmptyState title="No users yet." />
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Name</TableHeaderCell>
                  <TableHeaderCell>Login ID</TableHeaderCell>
                  <TableHeaderCell>Role</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                  <TableHeaderCell>Last Login</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>{u.fullName}</TableCell>
                    <TableCell>{u.loginId}</TableCell>
                    <TableCell>{u.roleName ?? '—'}</TableCell>
                    <TableCell>
                      <Badge tone={u.status === 'active' ? 'success' : u.status === 'locked' ? 'warning' : 'neutral'}>
                        {u.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-brand-800">Recent Activity</h2>
        </CardHeader>
        <CardBody>
          {recentActivity.length === 0 ? (
            <EmptyState title="No activity recorded yet." />
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {recentActivity.map((a) => (
                <li key={a.id} className="flex items-center justify-between border-b border-brand-100 pb-2 last:border-0">
                  <span className="text-brand-800">{a.action.replace(/_/g, ' ')}</span>
                  <span className="text-xs text-brand-400">{new Date(a.createdAt).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Dialog
        open={statusDialog !== null}
        onClose={() => setStatusDialog(null)}
        title="Confirm status change"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setStatusDialog(null)} disabled={isChangingStatus}>
              Cancel
            </Button>
            <Button variant="danger" isLoading={isChangingStatus} onClick={confirmStatusChange}>
              Confirm
            </Button>
          </div>
        }
      >
        {statusDialog && (
          <p className="text-sm text-brand-600">
            {statusDialog.newStatus === 'suspended' &&
              `Suspend ${store.storeCode}? Users from this store will no longer be able to sign in, and active sessions will be revoked immediately.`}
            {statusDialog.newStatus === 'archived' &&
              `Archive ${store.storeCode}? This store will be hidden from the active list and users will no longer be able to sign in. Data is not deleted.`}
            {statusDialog.newStatus === 'active' && `Reactivate ${store.storeCode}?`}
          </p>
        )}
      </Dialog>

      <Dialog
        open={resetDialogOpen}
        onClose={() => {
          setResetDialogOpen(false);
          setResetError(null);
          setNewPassword('');
          setConfirmPassword('');
        }}
        title="Reset Store Admin Password"
      >
        <form onSubmit={handleResetPassword} className="flex flex-col gap-4">
          <Input
            label="New Password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            hint="At least 8 characters."
            required
          />
          <Input
            label="Confirm New Password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
          {resetError && <p className="text-sm text-red-600">{resetError}</p>}
          <Button type="submit" isLoading={isResetting}>
            Reset Password
          </Button>
        </form>
      </Dialog>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-brand-400">{label}</dt>
      <dd className="mt-1 text-brand-800">{value || '—'}</dd>
    </div>
  );
}
