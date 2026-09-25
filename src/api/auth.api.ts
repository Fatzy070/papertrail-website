import { apiRequest } from './client'

export interface User { id: string; name: string; email: string; emailVerified: boolean; profile: { initials: string; imageUrl: string | null } }
export interface Credentials { email: string; password: string }

export const authApi = {
  me: () => apiRequest<User>('/auth/me'),
  register: (payload: { name: string } & Credentials) => apiRequest<{ success: boolean; requiresEmailVerification: boolean; message: string }>('/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
  login: (payload: Credentials) => apiRequest<User>('/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
  google: (credential: string) => apiRequest<User>('/auth/google', { method: 'POST', body: JSON.stringify({ credential }) }),
  logout: () => apiRequest<{ success: boolean }>('/auth/logout', { method: 'POST' }),
  verifyEmail: (payload: { email: string; code: string }) => apiRequest<User>('/auth/verify-email', { method: 'POST', body: JSON.stringify(payload) }),
  resendVerification: (payload: { email: string }) => apiRequest<{ success: boolean }>('/auth/resend-verification', { method: 'POST', body: JSON.stringify(payload) }),
  forgotPassword: (payload: { email: string }) => apiRequest<{ success: boolean }>('/auth/forgot-password', { method: 'POST', body: JSON.stringify(payload) }),
  resetPassword: (payload: { email: string; code: string; password: string }) => apiRequest<{ success: boolean }>('/auth/reset-password', { method: 'POST', body: JSON.stringify(payload) }),
}
