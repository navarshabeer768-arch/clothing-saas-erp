import type { UUID, ISODateTime, StoreStatus } from './database';

export interface StoreListItem {
  id: UUID;
  storeCode: string;
  businessName: string;
  ownerName: string;
  mobile: string;
  country: string;
  currencyCode: string;
  status: StoreStatus;
  createdAt: ISODateTime;
  userCount: number;
}

export interface PaginationInfo {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface ListStoresResponse {
  stores: StoreListItem[];
  pagination: PaginationInfo;
}

export interface ListStoresParams {
  search?: string;
  status?: StoreStatus | '';
  country?: string;
  page?: number;
  pageSize?: number;
}

export interface StoreDetails {
  id: UUID;
  storeCode: string;
  businessName: string;
  legalName: string | null;
  ownerName: string;
  mobile: string;
  whatsapp: string | null;
  email: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  country: string;
  postalCode: string | null;
  currencyCode: string;
  timezone: string;
  taxNumber: string | null;
  logoUrl: string | null;
  status: StoreStatus;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface StoreUserSummaryItem {
  id: UUID;
  loginId: string;
  fullName: string;
  status: string;
  lastLoginAt: ISODateTime | null;
  createdAt: ISODateTime;
  roleName: string | null;
}

export interface StoreDetailsResponse {
  store: StoreDetails;
  usersSummary: { totalUsers: number; activeUsers: number; disabledUsers: number };
  users: StoreUserSummaryItem[];
  admin: {
    id: UUID;
    loginId: string;
    fullName: string;
    status: string;
    lastLoginAt: ISODateTime | null;
  } | null;
  usage: { userCount: number; auditActivityCount: number };
  recentActivity: Array<{ id: UUID; action: string; createdAt: ISODateTime; performedBySaasAdmin: boolean }>;
}

export interface CreateStoreRequest {
  businessName: string;
  legalName?: string;
  ownerName: string;
  mobile: string;
  whatsapp?: string;
  email?: string;
  addressLine1: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  country: string;
  postalCode?: string;
  currencyCode: string;
  timezone: string;
  taxNumber?: string;
  admin: {
    fullName: string;
    loginId: string;
    password: string;
    confirmPassword: string;
    phone?: string;
  };
}

export interface CreateStoreResponse {
  store: { id: UUID; storeCode: string };
  admin: { id: UUID; loginId: string };
}

export type UpdateStoreRequest = Partial<
  Omit<CreateStoreRequest, 'admin'>
>;

export interface StoreStatusChangeRequest {
  storeId: UUID;
  newStatus: StoreStatus;
}

export interface StoreStatusChangeResponse {
  success: boolean;
  status: StoreStatus;
  revokedSessionCount: number;
}

export interface ResetStoreAdminPasswordRequest {
  storeId: UUID;
  storeUserId: UUID;
  newPassword: string;
  confirmPassword: string;
}

export interface SaasDashboardSummary {
  totalStores: number;
  activeStores: number;
  suspendedStores: number;
  archivedStores: number;
  inactiveStores: number;
  totalStoreUsers: number;
  storesCreatedThisMonth: number;
}

export interface SaasDashboardResponse {
  summary: SaasDashboardSummary;
  recentStores: Array<{
    id: UUID;
    storeCode: string;
    businessName: string;
    ownerName: string;
    status: StoreStatus;
    createdAt: ISODateTime;
  }>;
  recentActivity: Array<{ id: UUID; action: string; createdAt: ISODateTime; storeId: UUID | null }>;
}

/** Backend validation error shape returned by create/update store endpoints. */
export interface ValidationErrorResponse {
  code: 'VALIDATION_ERROR';
  message: string;
  errors: Record<string, string>;
}
