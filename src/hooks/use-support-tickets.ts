import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supportTicketsApi, type CreateSupportTicketPayload } from '../api/support-tickets.api'

export const supportTicketKeys = { mine: ['support-tickets', 'mine'] as const }

export function useMySupportTickets() {
  return useQuery({ queryKey: supportTicketKeys.mine, queryFn: supportTicketsApi.listMine })
}

export function useCreateSupportTicket() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateSupportTicketPayload) => supportTicketsApi.create(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: supportTicketKeys.mine }),
  })
}
