import { apiRequest } from './client'

export type SupportTicketCategory =
  | 'GENERAL'
  | 'ACCOUNT'
  | 'PDF_EDITOR'
  | 'DOCUMENT_UPLOAD'
  | 'DOCUMENT_STORAGE'
  | 'BUG'
  | 'FEATURE_REQUEST'
  | 'OTHER'

export type SupportTicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED'

export interface SupportTicket {
  id: string
  reference: string
  subject: string
  category: SupportTicketCategory
  status: SupportTicketStatus
  createdAt: string
  updatedAt: string
}

export interface CreateSupportTicketPayload {
  subject: string
  category: SupportTicketCategory
  message: string
}

export const supportTicketsApi = {
  create: (payload: CreateSupportTicketPayload) =>
    apiRequest<SupportTicket>('/support-tickets', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  listMine: () => apiRequest<SupportTicket[]>('/support-tickets/me'),
}
