import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { authApi } from '../api/auth.api'

export const authKeys = { current: ['auth', 'current-user'] as const }

export function useCurrentUser() {
  return useQuery({ queryKey: authKeys.current, queryFn: authApi.me, retry: false, staleTime: 60_000 })
}

export function useLogin() {
  const client = useQueryClient()
  return useMutation({ mutationFn: authApi.login, onSuccess: (user) => client.setQueryData(authKeys.current, user) })
}

export function useGoogleLogin() {
  const client = useQueryClient()
  return useMutation({ mutationFn: authApi.google, onSuccess: (user) => client.setQueryData(authKeys.current, user) })
}

export function useRegister() {
  return useMutation({ mutationFn: authApi.register })
}

export function useLogout() {
  const client = useQueryClient()
  return useMutation({ mutationFn: authApi.logout, onSuccess: () => client.setQueryData(authKeys.current, null) })
}

export function useVerifyEmail() {
  const client = useQueryClient()
  return useMutation({ mutationFn: authApi.verifyEmail, onSuccess: (user) => client.setQueryData(authKeys.current, user) })
}

export function useResendVerification() {
  return useMutation({ mutationFn: authApi.resendVerification })
}

export function useForgotPassword() {
  return useMutation({ mutationFn: authApi.forgotPassword })
}

export function useResetPassword() {
  return useMutation({ mutationFn: authApi.resetPassword })
}
