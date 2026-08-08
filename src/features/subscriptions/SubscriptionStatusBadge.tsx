import { Badge } from '../../components/ui';
import type { SubscriptionStatus } from '../../types/subscriptions';

const TONE: Record<SubscriptionStatus, 'success' | 'warning' | 'neutral' | 'danger' | 'info'> = {
  trial: 'info',
  active: 'success',
  expired: 'danger',
  suspended: 'warning',
  cancelled: 'neutral',
};

const LABEL: Record<SubscriptionStatus, string> = {
  trial: 'Trial',
  active: 'Active',
  expired: 'Expired',
  suspended: 'Suspended',
  cancelled: 'Cancelled',
};

export function SubscriptionStatusBadge({ status, daysRemaining }: { status: SubscriptionStatus; daysRemaining?: number }) {
  const showExpiringSoon = (status === 'trial' || status === 'active') && typeof daysRemaining === 'number' && daysRemaining <= 7;
  return <Badge tone={showExpiringSoon ? 'warning' : TONE[status]}>{showExpiringSoon ? 'Expiring Soon' : LABEL[status]}</Badge>;
}
