import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  PageHeader,
  Card,
  CardBody,
  Button,
  Badge,
  Dialog,
  Input,
  Select,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
  PageLoading,
  EmptyState,
  useToast,
} from '../../components/ui';
import { listPlans, createPlan, updatePlan, changePlanStatus } from '../../features/subscriptions/subscriptionService';
import type { SubscriptionPlan, PlanStatus } from '../../types/subscriptions';
import { AppError } from '../../lib/errors';

const STATUS_TONE: Record<PlanStatus, 'success' | 'neutral' | 'danger'> = {
  active: 'success',
  inactive: 'neutral',
  archived: 'danger',
};

interface PlanFormState {
  name: string;
  code: string;
  description: string;
  monthlyPrice: string;
  yearlyPrice: string;
  currencyCode: string;
  trialDays: string;
  maxUsers: string;
  maxBranches: string;
  maxProducts: string;
  maxStorageMb: string;
}

const EMPTY_FORM: PlanFormState = {
  name: '',
  code: '',
  description: '',
  monthlyPrice: '0',
  yearlyPrice: '0',
  currencyCode: 'QAR',
  trialDays: '0',
  maxUsers: '',
  maxBranches: '',
  maxProducts: '',
  maxStorageMb: '',
};

export function PlanListPage() {
  const { showToast } = useToast();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<PlanFormState>(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [editForm, setEditForm] = useState<PlanFormState>(EMPTY_FORM);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await listPlans();
      setPlans(result.plans);
    } catch (err) {
      showToast(err instanceof AppError ? err.message : 'Could not load plans.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await createPlan({
        name: form.name,
        code: form.code,
        description: form.description || undefined,
        monthlyPrice: Number(form.monthlyPrice) || 0,
        yearlyPrice: Number(form.yearlyPrice) || 0,
        currencyCode: form.currencyCode,
        trialDays: Number(form.trialDays) || 0,
        maxUsers: form.maxUsers ? Number(form.maxUsers) : null,
        maxBranches: form.maxBranches ? Number(form.maxBranches) : null,
        maxProducts: form.maxProducts ? Number(form.maxProducts) : null,
        maxStorageMb: form.maxStorageMb ? Number(form.maxStorageMb) : null,
      });
      showToast('Plan created.', 'success');
      setCreateOpen(false);
      setForm(EMPTY_FORM);
      await load();
    } catch (err) {
      showToast(err instanceof AppError ? err.message : 'Could not create plan.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }

  function openEdit(plan: SubscriptionPlan) {
    setEditingPlan(plan);
    setEditForm({
      name: plan.name,
      code: plan.code,
      description: plan.description ?? '',
      monthlyPrice: String(plan.monthlyPrice),
      yearlyPrice: String(plan.yearlyPrice),
      currencyCode: plan.currencyCode,
      trialDays: String(plan.trialDays),
      maxUsers: plan.maxUsers?.toString() ?? '',
      maxBranches: plan.maxBranches?.toString() ?? '',
      maxProducts: plan.maxProducts?.toString() ?? '',
      maxStorageMb: plan.maxStorageMb?.toString() ?? '',
    });
  }

  async function handleSaveEdit(event: FormEvent) {
    event.preventDefault();
    if (!editingPlan) return;
    setIsSavingEdit(true);
    try {
      await updatePlan(editingPlan.id, {
        name: editForm.name,
        description: editForm.description || undefined,
        monthlyPrice: Number(editForm.monthlyPrice) || 0,
        yearlyPrice: Number(editForm.yearlyPrice) || 0,
        trialDays: Number(editForm.trialDays) || 0,
        maxUsers: editForm.maxUsers ? Number(editForm.maxUsers) : null,
        maxBranches: editForm.maxBranches ? Number(editForm.maxBranches) : null,
        maxProducts: editForm.maxProducts ? Number(editForm.maxProducts) : null,
        maxStorageMb: editForm.maxStorageMb ? Number(editForm.maxStorageMb) : null,
      });
      showToast('Plan updated.', 'success');
      setEditingPlan(null);
      await load();
    } catch (err) {
      showToast(err instanceof AppError ? err.message : 'Could not update plan.', 'error');
    } finally {
      setIsSavingEdit(false);
    }
  }

  async function handleStatusChange(plan: SubscriptionPlan, newStatus: PlanStatus) {
    try {
      await changePlanStatus(plan.id, newStatus);
      showToast(`Plan ${newStatus}.`, 'success');
      await load();
    } catch (err) {
      showToast(err instanceof AppError ? err.message : 'Could not update plan status.', 'error');
    }
  }

  return (
    <div>
      <PageHeader
        title="Subscription Plans"
        description="Manage the plans stores can subscribe to."
        actions={<Button onClick={() => setCreateOpen(true)}>+ Add Plan</Button>}
      />

      {isLoading ? (
        <PageLoading label="Loading plans…" />
      ) : plans.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              title="No plans have been created yet."
              action={<Button onClick={() => setCreateOpen(true)}>Add Plan</Button>}
            />
          </CardBody>
        </Card>
      ) : (
        <div className="hidden md:block">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Plan</TableHeaderCell>
                <TableHeaderCell>Monthly</TableHeaderCell>
                <TableHeaderCell>Yearly</TableHeaderCell>
                <TableHeaderCell>Trial Days</TableHeaderCell>
                <TableHeaderCell>User Limit</TableHeaderCell>
                <TableHeaderCell>Product Limit</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Stores</TableHeaderCell>
                <TableHeaderCell></TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {plans.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell>
                    <span className="font-medium text-brand-800">{plan.name}</span>
                    <div className="text-xs text-brand-500">{plan.code}</div>
                  </TableCell>
                  <TableCell>
                    {plan.currencyCode} {plan.monthlyPrice}
                  </TableCell>
                  <TableCell>
                    {plan.currencyCode} {plan.yearlyPrice}
                  </TableCell>
                  <TableCell>{plan.trialDays}</TableCell>
                  <TableCell>{plan.maxUsers ?? 'Unlimited'}</TableCell>
                  <TableCell>{plan.maxProducts ?? 'Unlimited'}</TableCell>
                  <TableCell>
                    <Badge tone={STATUS_TONE[plan.status]}>{plan.status}</Badge>
                  </TableCell>
                  <TableCell>{plan.storeCount}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="secondary" onClick={() => openEdit(plan)}>
                        Edit
                      </Button>
                      {plan.status === 'active' ? (
                        <Button size="sm" variant="ghost" onClick={() => handleStatusChange(plan, 'inactive')}>
                          Deactivate
                        </Button>
                      ) : plan.status === 'inactive' ? (
                        <Button size="sm" variant="ghost" onClick={() => handleStatusChange(plan, 'active')}>
                          Activate
                        </Button>
                      ) : null}
                      {plan.status !== 'archived' && (
                        <Button size="sm" variant="danger" onClick={() => handleStatusChange(plan, 'archived')}>
                          Archive
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Mobile cards */}
      <div className="flex flex-col gap-3 md:hidden">
        {plans.map((plan) => (
          <Card key={plan.id}>
            <CardBody>
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-brand-800">{plan.name}</p>
                  <p className="text-xs text-brand-500">{plan.code}</p>
                </div>
                <Badge tone={STATUS_TONE[plan.status]}>{plan.status}</Badge>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-brand-500">
                <div>
                  <dt className="uppercase tracking-wide">Monthly</dt>
                  <dd className="text-brand-800">
                    {plan.currencyCode} {plan.monthlyPrice}
                  </dd>
                </div>
                <div>
                  <dt className="uppercase tracking-wide">Stores</dt>
                  <dd className="text-brand-800">{plan.storeCount}</dd>
                </div>
              </dl>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => openEdit(plan)}>
                  Edit
                </Button>
                {plan.status !== 'archived' && (
                  <Button size="sm" variant="danger" onClick={() => handleStatusChange(plan, 'archived')}>
                    Archive
                  </Button>
                )}
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} title="Add Plan">
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <Input label="Plan Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input
            label="Plan Code"
            required
            placeholder="STARTER"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
          />
          <Input label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Monthly Price"
              type="number"
              value={form.monthlyPrice}
              onChange={(e) => setForm({ ...form, monthlyPrice: e.target.value })}
            />
            <Input
              label="Yearly Price"
              type="number"
              value={form.yearlyPrice}
              onChange={(e) => setForm({ ...form, yearlyPrice: e.target.value })}
            />
            <Select label="Currency" value={form.currencyCode} onChange={(e) => setForm({ ...form, currencyCode: e.target.value })}>
              {['QAR', 'AED', 'SAR', 'USD'].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
            <Input label="Trial Days" type="number" value={form.trialDays} onChange={(e) => setForm({ ...form, trialDays: e.target.value })} />
            <Input
              label="Max Users (blank = unlimited)"
              type="number"
              value={form.maxUsers}
              onChange={(e) => setForm({ ...form, maxUsers: e.target.value })}
            />
            <Input
              label="Max Branches"
              type="number"
              value={form.maxBranches}
              onChange={(e) => setForm({ ...form, maxBranches: e.target.value })}
            />
            <Input
              label="Max Products"
              type="number"
              value={form.maxProducts}
              onChange={(e) => setForm({ ...form, maxProducts: e.target.value })}
            />
            <Input
              label="Storage (MB)"
              type="number"
              value={form.maxStorageMb}
              onChange={(e) => setForm({ ...form, maxStorageMb: e.target.value })}
            />
          </div>
          <Button type="submit" isLoading={isSubmitting}>
            Create Plan
          </Button>
        </form>
      </Dialog>

      <Dialog open={editingPlan !== null} onClose={() => setEditingPlan(null)} title={`Edit ${editingPlan?.name ?? ''}`}>
        {editingPlan && editingPlan.storeCount > 0 && (
          <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
            This plan is currently used by {editingPlan.storeCount} store{editingPlan.storeCount === 1 ? '' : 's'}. Changes may
            affect their access and limits.
          </p>
        )}
        <form onSubmit={handleSaveEdit} className="flex flex-col gap-4">
          <Input label="Plan Name" required value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
          <Input label="Description" value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Monthly Price"
              type="number"
              value={editForm.monthlyPrice}
              onChange={(e) => setEditForm({ ...editForm, monthlyPrice: e.target.value })}
            />
            <Input
              label="Yearly Price"
              type="number"
              value={editForm.yearlyPrice}
              onChange={(e) => setEditForm({ ...editForm, yearlyPrice: e.target.value })}
            />
            <Input
              label="Trial Days"
              type="number"
              value={editForm.trialDays}
              onChange={(e) => setEditForm({ ...editForm, trialDays: e.target.value })}
            />
            <Input
              label="Max Users"
              type="number"
              value={editForm.maxUsers}
              onChange={(e) => setEditForm({ ...editForm, maxUsers: e.target.value })}
            />
            <Input
              label="Max Branches"
              type="number"
              value={editForm.maxBranches}
              onChange={(e) => setEditForm({ ...editForm, maxBranches: e.target.value })}
            />
            <Input
              label="Max Products"
              type="number"
              value={editForm.maxProducts}
              onChange={(e) => setEditForm({ ...editForm, maxProducts: e.target.value })}
            />
            <Input
              label="Storage (MB)"
              type="number"
              value={editForm.maxStorageMb}
              onChange={(e) => setEditForm({ ...editForm, maxStorageMb: e.target.value })}
            />
          </div>
          <Button type="submit" isLoading={isSavingEdit}>
            Save Changes
          </Button>
        </form>
      </Dialog>
    </div>
  );
}
