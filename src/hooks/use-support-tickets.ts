import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supportTicketsApi } from '../api/support-tickets.api'

export const supportTicketKeys = { 
  mine: ['support-tickets', 'mine'] as const,
  messages: (ticketId: string) => ['support-tickets', 'messages', ticketId] as const,
}

export function useMySupportTickets() {
  return useQuery({ queryKey: supportTicketKeys.mine, queryFn: supportTicketsApi.listMine })
}

export function useCreateSupportTicket() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: FormData) => supportTicketsApi.create(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: supportTicketKeys.mine }),
  })
}

export function useSupportTicketMessages(ticketId: string) {
  return useQuery({
    queryKey: supportTicketKeys.messages(ticketId),
    queryFn: () => supportTicketsApi.getMessages(ticketId),
    enabled: !!ticketId,
  })
}

export function useReplySupportTicket() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ ticketId, formData }: { ticketId: string, formData: FormData }) => 
      supportTicketsApi.reply(ticketId, formData),
    onSuccess: (_, { ticketId }) => {
      queryClient.invalidateQueries({ queryKey: supportTicketKeys.messages(ticketId) })
      queryClient.invalidateQueries({ queryKey: supportTicketKeys.mine })
    },
  })
}

export function useReopenSupportTicket() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (ticketId: string) => supportTicketsApi.reopen(ticketId),
    onSuccess: (_, ticketId) => {
      queryClient.invalidateQueries({ queryKey: supportTicketKeys.messages(ticketId) })
      queryClient.invalidateQueries({ queryKey: supportTicketKeys.mine })
    },
  })
}
