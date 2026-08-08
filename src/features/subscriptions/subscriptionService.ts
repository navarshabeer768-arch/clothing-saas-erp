import { apiRequest } from '../../lib/apiClient';
import type {
  SubscriptionPlan,
  CreatePlanRequest,
  UpdatePlanRequest,
  ListSubscriptionsParams,
  StoreSubscriptionListItem,
  StoreSubscriptionResponse,
  PlanStatus,
} from '../../types/subscriptions';
import type { PaginationInfo } from '../../types/storeManagement';

export function listPlans(): Promise<{ plans: SubscriptionPlan[] }> {
  return apiRequest('/saas-list-plans', { method: 'GET' });
}

export function createPlan(request: CreatePlanRequest): Promise<{ plan: { id: string; code: string } }> {
  return apiRequest('/saas-create-plan', { method: 'POST', body: request });
}

export function updatePlan(id: string, request: UpdatePlanRequest & { features?: unknown }): Promise<{ success: boolean }> {
  return apiRequest(`/saas-update-plan?id=${encodeURIComponent(id)}`, { method: 'PATCH', body: request });
}

export function changePlanStatus(planId: string, newStatus: PlanStatus): Promise<{ success: boolean }> {
  return apiRequest('/saas-plan-status', { method: 'POST', body: { planId, newStatus } });
}

export function listSubscriptions(
  params: ListSubscriptionsParams = {}
): Promise<{ subscriptions: StoreSubscriptionListItem[]; pagination: PaginationInfo }> {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.planId) query.set('planId', params.planId);
  if (params.status) query.set('status', params.status);
  if (params.billingCycle) query.set('billingCycle', params.billingCycle);
  if (params.expiringWithinDays) query.set('expiringWithinDays', String(params.expiringWithinDays));
  query.set('page', String(params.page ?? 1));
  query.set('pageSize', String(params.pageSize ?? 20));

  return apiRequest(`/saas-list-subscriptions?${query.toString()}`, { method: 'GET' });
}

export function getStoreSubscription(storeId: string): Promise<StoreSubscriptionResponse> {
  return apiRequest(`/saas-get-store-subscription?storeId=${encodeURIComponent(storeId)}`, { method: 'GET' });
}

export function changeStorePlan(request: {
  storeId: string;
  newPlanId: string;
  billingCycle: string;
  periodEnd?: string;
  notes?: string;
}): Promise<{ success: boolean }> {
  return apiRequest('/saas-change-store-plan', { method: 'POST', body: request });
}

export function renewSubscription(request: {
  storeId: string;
  months?: number;
  years?: number;
  customPeriodEnd?: string;
  billingCycle?: string;
  notes?: string;
}): Promise<{ success: boolean; newPeriodEnd: string }> {
  return apiRequest('/saas-renew-subscription', { method: 'POST', body: request });
}

export function extendSubscription(request: {
  storeId: string;
  days?: number;
  customDate?: string;
  reason?: string;
}): Promise<{ success: boolean; newPeriodEnd: string }> {
  return apiRequest('/saas-extend-subscription', { method: 'POST', body: request });
}

export function changeSubscriptionStatus(request: {
  storeId: string;
  newStatus: string;
  notes?: string;
}): Promise<{ success: boolean }> {
  return apiRequest('/saas-subscription-status', { method: 'POST', body: request });
}
