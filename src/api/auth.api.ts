import { authToken } from './auth-token'
import { ApiError, apiRequest } from './client'

export interface User { id: string; name: string; email: string; emailVerified: boolean; profile: { initials: string; imageUrl: string | null } }
export interface Credentials { email: string; password: string }

export interface AuthResponse { user: User; token: string }

const handleAuthResponse = async (request: Promise<AuthResponse>): Promise<User> => {
  const { user, token } = await request;
  if (token) {
    authToken.write(token);
  }
  return user;
};

export const authApi = {
  me: async () => {
    try { return await apiRequest<User>('/auth/me') } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        authToken.clear()
        return null
      }
      throw error
    }
  },
  register: (payload: { name: string } & Credentials) => apiRequest<{ success: boolean; requiresEmailVerification: boolean; message: string }>('/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
  login: (payload: Credentials) => handleAuthResponse(apiRequest<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(payload) })),
  google: (credential: string) => handleAuthResponse(apiRequest<AuthResponse>('/auth/google', { method: 'POST', body: JSON.stringify({ credential }) })),
  logout: async () => {
    authToken.clear();
    return apiRequest<{ success: boolean }>('/auth/logout', { method: 'POST' });
  },
  verifyEmail: (payload: { email: string; code: string }) => handleAuthResponse(apiRequest<AuthResponse>('/auth/verify-email', { method: 'POST', body: JSON.stringify(payload) })),
  resendVerification: (payload: { email: string }) => apiRequest<{ success: boolean }>('/auth/resend-verification', { method: 'POST', body: JSON.stringify(payload) }),
  forgotPassword: (payload: { email: string }) => apiRequest<{ success: boolean }>('/auth/forgot-password', { method: 'POST', body: JSON.stringify(payload) }),
  resetPassword: (payload: { email: string; code: string; password: string }) => apiRequest<{ success: boolean }>('/auth/reset-password', { method: 'POST', body: JSON.stringify(payload) }),
}
