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

export interface SupportTicketAttachment {
  storageKey: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
}

export interface SupportMessage {
  id: string
  senderId: string | { id: string, name: string, email: string, role: string }
  senderRole: 'USER' | 'ADMIN'
  message: string
  attachments: SupportTicketAttachment[]
  createdAt: string
}

export interface SupportTicket {
  id: string
  reference: string
  subject: string
  category: SupportTicketCategory
  status: SupportTicketStatus
  replyCount?: number
  userUnreadCount?: number
  adminUnreadCount?: number
  createdAt: string
  updatedAt: string
}

export interface SupportTicketThread {
  ticket: SupportTicket
  messages: SupportMessage[]
}

export const supportTicketsApi = {
  create: (formData: FormData) =>
    apiRequest<SupportTicket>('/support-tickets', {
      method: 'POST',
      body: formData,
    }),
  listMine: () => apiRequest<SupportTicket[]>('/support-tickets/me'),
  getMessages: (ticketId: string) => 
    apiRequest<SupportTicketThread>(`/support-tickets/${ticketId}/messages`),
  reply: (ticketId: string, formData: FormData) => 
    apiRequest<SupportTicketThread>(`/support-tickets/${ticketId}/messages`, {
      method: 'POST',
      body: formData,
    }),
  reopen: (ticketId: string) => 
    apiRequest<SupportTicketThread>(`/support-tickets/${ticketId}/reopen`, {
      method: 'POST'
    }),
  getAttachmentUrl: (ticketId: string, storageKey: string) => 
    apiRequest<{url: string}>(`/support-tickets/${ticketId}/attachments?key=${encodeURIComponent(storageKey)}`)
}
