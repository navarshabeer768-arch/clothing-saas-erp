import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  Card,
  CardHeader,
  CardBody,
  Button,
  Dialog,
  Select,
  Input,
  PageLoading,
  useToast,
} from '../../components/ui';
import { SubscriptionStatusBadge } from './SubscriptionStatusBadge';
import {
  getStoreSubscription,
  listPlans,
  changeStorePlan,
  renewSubscription,
  extendSubscription,
} from './subscriptionService';
import type { StoreSubscriptionResponse, SubscriptionPlan } from '../../types/subscriptions';
import { AppError } from '../../lib/errors';

type DialogKind = 'changePlan' | 'renew' | 'extend' | null;

export function StoreSubscriptionCard({ storeId }: { storeId: string }) {
  const { showToast } = useToast();
  const [data, setData] = useState<StoreSubscriptionResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [openDialog, setOpenDialog] = useState<DialogKind>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Change plan form
  const [newPlanId, setNewPlanId] = useState('');
  const [newBillingCycle, setNewBillingCycle] = useState('monthly');

  // Renew form
  const [renewMonths, setRenewMonths] = useState('1');

  // Extend form
  const [extendDays, setExtendDays] = useState('7');
  const [extendReason, setExtendReason] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getStoreSubscription(storeId);
      setData(result);
    } catch (err) {
      showToast(err instanceof AppError ? err.message : 'Could not load subscription.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [storeId, showToast]);

  useEffect(() => {
    load();
    listPlans()
      .then((r) => setPlans(r.plans.filter((p) => p.status === 'active')))
      .catch(() => undefined);
  }, [load]);

  async function handleChangePlan(e: FormEvent) {
    e.preventDefault();
    if (!newPlanId) return;
    setIsSubmitting(true);
    try {
      await changeStorePlan({ storeId, newPlanId, billingCycle: newBillingCycle });
      showToast('Plan changed.', 'success');
      setOpenDialog(null);
      await load();
    } catch (err) {
      showToast(err instanceof AppError ? err.message : 'Could not change plan.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRenew(e: FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await renewSubscription({ storeId, months: Number(renewMonths) });
      showToast('Subscription renewed.', 'success');
      setOpenDialog(null);
      await load();
    } catch (err) {
      showToast(err instanceof AppError ? err.message : 'Could not renew subscription.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleExtend(e: FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await extendSubscription({ storeId, days: Number(extendDays), reason: extendReason || undefined });
      showToast('Subscription extended.', 'success');
      setOpenDialog(null);
      await load();
    } catch (err) {
      showToast(err instanceof AppError ? err.message : 'Could not extend subscription.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <Card className="mb-6">
        <CardBody>
          <PageLoading label="Loading subscription…" />
        </CardBody>
      </Card>
    );
  }

  if (!data?.subscription) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <h2 className="text-sm font-semibold text-brand-800">Subscription</h2>
        </CardHeader>
        <CardBody>
          <p className="text-sm text-brand-400">This store has no subscription on record.</p>
        </CardBody>
      </Card>
    );
  }

  const { subscription, usage, history } = data;

  return (
    <>
      <Card className="mb-6">
        <CardHeader className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-brand-800">Subscription</h2>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => setOpenDialog('changePlan')}>
              Change Plan
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setOpenDialog('renew')}>
              Renew
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setOpenDialog('extend')}>
              Extend
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs uppercase tracking-wide text-brand-400">Plan</dt>
              <dd className="mt-1 font-medium text-brand-800">{subscription.planName}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-brand-400">Status</dt>
              <dd className="mt-1">
                <SubscriptionStatusBadge status={subscription.effectiveStatus} daysRemaining={subscription.daysRemaining} />
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-brand-400">Billing Cycle</dt>
              <dd className="mt-1 capitalize text-brand-800">{subscription.billingCycle}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-brand-400">Period End</dt>
              <dd className="mt-1 text-brand-800">{new Date(subscription.currentPeriodEnd).toLocaleDateString()}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-brand-400">Days Remaining</dt>
              <dd className="mt-1 text-brand-800">{subscription.daysRemaining}</dd>
            </div>
            {usage && (
              <div>
                <dt className="text-xs uppercase tracking-wide text-brand-400">Users</dt>
                <dd className="mt-1 text-brand-800">
                  {usage.users.current ?? '—'} / {usage.users.limit ?? 'Unlimited'}
                </dd>
              </div>
            )}
          </dl>

          {subscription.featureKeys.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-400">Available Features</p>
              <div className="flex flex-wrap gap-1.5">
                {subscription.featureKeys.map((key) => (
                  <span key={key} className="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs text-brand-700">
                    {key}
                  </span>
                ))}
              </div>
            </div>
          )}

          {history.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-400">Subscription History</p>
              <ul className="flex flex-col gap-2 text-sm">
                {history.map((h) => (
                  <li key={h.id} className="flex items-center justify-between border-b border-brand-100 pb-2 last:border-0">
                    <span className="text-brand-800">{h.action.replace(/_/g, ' ')}</span>
                    <span className="text-xs text-brand-400">{new Date(h.effectiveAt).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardBody>
      </Card>

      <Dialog open={openDialog === 'changePlan'} onClose={() => setOpenDialog(null)} title="Change Plan">
        <form onSubmit={handleChangePlan} className="flex flex-col gap-4">
          <Select label="New Plan" required value={newPlanId} onChange={(e) => setNewPlanId(e.target.value)}>
            <option value="">Select a plan…</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <Select label="Billing Cycle" value={newBillingCycle} onChange={(e) => setNewBillingCycle(e.target.value)}>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </Select>
          <Button type="submit" isLoading={isSubmitting}>
            Change Plan
          </Button>
        </form>
      </Dialog>

      <Dialog open={openDialog === 'renew'} onClose={() => setOpenDialog(null)} title="Renew Subscription">
        <form onSubmit={handleRenew} className="flex flex-col gap-4">
          <Select label="Renewal Period" value={renewMonths} onChange={(e) => setRenewMonths(e.target.value)}>
            <option value="1">1 month</option>
            <option value="3">3 months</option>
            <option value="6">6 months</option>
            <option value="12">1 year</option>
          </Select>
          <Button type="submit" isLoading={isSubmitting}>
            Renew
          </Button>
        </form>
      </Dialog>

      <Dialog open={openDialog === 'extend'} onClose={() => setOpenDialog(null)} title="Extend Subscription">
        <form onSubmit={handleExtend} className="flex flex-col gap-4">
          <Select label="Extend By" value={extendDays} onChange={(e) => setExtendDays(e.target.value)}>
            <option value="7">+7 days</option>
            <option value="14">+14 days</option>
            <option value="30">+30 days</option>
          </Select>
          <Input label="Reason (optional)" value={extendReason} onChange={(e) => setExtendReason(e.target.value)} />
          <Button type="submit" isLoading={isSubmitting}>
            Extend
          </Button>
        </form>
      </Dialog>
    </>
  );
}
