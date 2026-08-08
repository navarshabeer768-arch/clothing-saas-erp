import { apiRequest } from '../../lib/apiClient';
import type {
  StoreLoginRequest,
  StoreLoginResponse,
  SaasLoginRequest,
  SaasLoginResponse,
  SessionMeResponse,
  ChangePasswordRequest,
} from '../../types/auth';

/**
 * Frontend-side auth service. Each function is a thin wrapper around a
 * single Edge Function call — no business logic lives here, that's all
 * server-side (see supabase/functions/). Keeping this layer thin means the
 * "what does the frontend send/receive" contract lives entirely in
 * src/types/auth.ts, matching the server's actual response shapes.
 */

export function storeLogin(request: StoreLoginRequest): Promise<StoreLoginResponse> {
  return apiRequest<StoreLoginResponse>('/store-login', { method: 'POST', body: request });
}

export function saasLogin(request: SaasLoginRequest): Promise<SaasLoginResponse> {
  return apiRequest<SaasLoginResponse>('/saas-login', { method: 'POST', body: request });
}

export function fetchCurrentSession(): Promise<SessionMeResponse> {
  return apiRequest<SessionMeResponse>('/session-me', { method: 'GET' });
}

export function logout(): Promise<{ success: boolean }> {
  return apiRequest<{ success: boolean }>('/logout', { method: 'POST' });
}

export function logoutAllDevices(): Promise<{ success: boolean; revokedCount: number }> {
  return apiRequest<{ success: boolean; revokedCount: number }>('/logout-all', { method: 'POST' });
}

export function changePassword(request: ChangePasswordRequest): Promise<{ success: boolean }> {
  return apiRequest<{ success: boolean }>('/change-password', { method: 'POST', body: request });
}
