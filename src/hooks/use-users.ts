import { useMutation, useQueryClient } from '@tanstack/react-query'
import { usersApi } from '../api/users.api'
import { authKeys } from './use-auth'
export function useChangePassword() { return useMutation({ mutationFn: usersApi.changePassword }) }
export function useUploadProfileImage() { const client = useQueryClient(); return useMutation({ mutationFn: usersApi.uploadProfileImage, onSuccess: () => client.invalidateQueries({ queryKey: authKeys.current }) }) }
