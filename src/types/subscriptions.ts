import type { UUID, ISODateTime } from './database';

export type PlanStatus = 'active' | 'inactive' | 'archived';
export type SubscriptionStatus = 'trial' | 'active' | 'expired' | 'suspended' | 'cancelled';
export type BillingCycle = 'trial' | 'monthly' | 'yearly' | 'custom';

export interface PlanFeatureInput {
  featureKey: string;
  enabled: boolean;
  limitValue?: number | null;
}

export interface SubscriptionPlan {
  id: UUID;
  name: string;
  code: string;
  description: string | null;
  monthlyPrice: number;
  yearlyPrice: number;
  currencyCode: string;
  trialDays: number;
  maxUsers: number | null;
  maxBranches: number | null;
  maxProducts: number | null;
  maxStorageMb: number | null;
  status: PlanStatus;
  sortOrder: number;
  storeCount: number;
}

export interface CreatePlanRequest {
  name: string;
  code: string;
  description?: string;
  monthlyPrice: number;
  yearlyPrice: number;
  currencyCode: string;
  trialDays: number;
  maxUsers?: number | null;
  maxBranches?: number | null;
  maxProducts?: number | null;
  maxStorageMb?: number | null;
  sortOrder?: number;
  features?: PlanFeatureInput[];
}

export type UpdatePlanRequest = Partial<Omit<CreatePlanRequest, 'code'>>;

export interface StoreSubscriptionListItem {
  storeId: UUID;
  storeCode: string;
  businessName: string;
  planId: UUID;
  planName: string;
  status: SubscriptionStatus;
  effectiveStatus: SubscriptionStatus;
  billingCycle: BillingCycle;
  startedAt: ISODateTime;
  currentPeriodEnd: ISODateTime;
  daysRemaining: number;
}

export interface ListSubscriptionsParams {
  search?: string;
  planId?: string;
  status?: SubscriptionStatus | '';
  billingCycle?: BillingCycle | '';
  expiringWithinDays?: number;
  page?: number;
  pageSize?: number;
}

export interface StoreSubscriptionDetails {
  subscriptionId: UUID;
  planId: UUID;
  planName: string;
  planCode: string;
  status: SubscriptionStatus;
  effectiveStatus: SubscriptionStatus;
  billingCycle: BillingCycle;
  currentPeriodStart: ISODateTime;
  currentPeriodEnd: ISODateTime;
  daysRemaining: number;
  featureKeys: string[];
}

export interface UsageLimit {
  current: number | null;
  limit: number | null;
}

export interface StoreSubscriptionUsage {
  users: UsageLimit;
  branches: UsageLimit;
  products: UsageLimit;
}

export interface SubscriptionHistoryItem {
  id: UUID;
  action: string;
  previousPlanName: string | null;
  newPlanName: string | null;
  previousStatus: string | null;
  newStatus: string;
  effectiveAt: ISODateTime;
  performedBySaasAdmin: boolean;
  notes: string | null;
}

export interface StoreSubscriptionResponse {
  subscription: StoreSubscriptionDetails | null;
  usage: StoreSubscriptionUsage | null;
  history: SubscriptionHistoryItem[];
}
