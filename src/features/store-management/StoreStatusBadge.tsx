import { Badge } from '../../components/ui';
import type { StoreStatus } from '../../types/database';

const STATUS_TONE: Record<StoreStatus, 'success' | 'warning' | 'neutral' | 'danger'> = {
  active: 'success',
  suspended: 'warning',
  inactive: 'neutral',
  archived: 'danger',
};

const STATUS_LABEL: Record<StoreStatus, string> = {
  active: 'Active',
  suspended: 'Suspended',
  inactive: 'Inactive',
  archived: 'Archived',
};

export function StoreStatusBadge({ status }: { status: StoreStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}
