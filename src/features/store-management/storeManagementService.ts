import { apiRequest } from '../../lib/apiClient';
import type {
  ListStoresParams,
  ListStoresResponse,
  StoreDetailsResponse,
  CreateStoreRequest,
  CreateStoreResponse,
  UpdateStoreRequest,
  StoreStatusChangeRequest,
  StoreStatusChangeResponse,
  ResetStoreAdminPasswordRequest,
  SaasDashboardResponse,
} from '../../types/storeManagement';

/** Thin wrappers around the saas-* Edge Functions — no business logic here. */

export function listStores(params: ListStoresParams = {}): Promise<ListStoresResponse> {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.status) query.set('status', params.status);
  if (params.country) query.set('country', params.country);
  query.set('page', String(params.page ?? 1));
  query.set('pageSize', String(params.pageSize ?? 20));

  return apiRequest<ListStoresResponse>(`/saas-list-stores?${query.toString()}`, { method: 'GET' });
}

export function getStore(id: string): Promise<StoreDetailsResponse> {
  return apiRequest<StoreDetailsResponse>(`/saas-get-store?id=${encodeURIComponent(id)}`, { method: 'GET' });
}

export function createStore(request: CreateStoreRequest): Promise<CreateStoreResponse> {
  return apiRequest<CreateStoreResponse>('/saas-create-store', { method: 'POST', body: request });
}

export function updateStore(id: string, request: UpdateStoreRequest): Promise<{ store: { id: string; storeCode: string; businessName: string; status: string } }> {
  return apiRequest(`/saas-update-store?id=${encodeURIComponent(id)}`, { method: 'PATCH', body: request });
}

export function changeStoreStatus(request: StoreStatusChangeRequest): Promise<StoreStatusChangeResponse> {
  return apiRequest<StoreStatusChangeResponse>('/saas-store-status', { method: 'POST', body: request });
}

export function resetStoreAdminPassword(request: ResetStoreAdminPasswordRequest): Promise<{ success: boolean }> {
  return apiRequest<{ success: boolean }>('/saas-reset-store-admin-password', { method: 'POST', body: request });
}

export function getSaasDashboardSummary(): Promise<SaasDashboardResponse> {
  return apiRequest<SaasDashboardResponse>('/saas-dashboard-summary', { method: 'GET' });
}
