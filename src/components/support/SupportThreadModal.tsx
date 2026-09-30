import { useState } from 'react'
import { Dialog } from '../ui/Dialog'
import { useSupportTicketMessages, useReplySupportTicket, useReopenSupportTicket } from '../../hooks/use-support-tickets'
import { supportTicketsApi } from '../../api/support-tickets.api'
import { useToastStore } from '../../store/toast-store'
import { Send, Paperclip, X } from 'lucide-react'

export function SupportThreadModal({ ticketId, onClose }: { ticketId: string, onClose: () => void }) {
  const { data, isPending, isError } = useSupportTicketMessages(ticketId)
  const replyMutation = useReplySupportTicket()
  const reopenMutation = useReopenSupportTicket()
  const show = useToastStore((state) => state.show)
  
  const [message, setMessage] = useState('')
  const [attachments, setAttachments] = useState<File[]>([])

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const newFiles = Array.from(event.target.files)
      const validFiles = newFiles.filter((file) => {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
          show(`${file.name} is not a valid image format.`, 'error')
          return false
        }
        if (file.size > 5 * 1024 * 1024) {
          show(`${file.name} is larger than 5 MB.`, 'error')
          return false
        }
        return true
      })

      setAttachments((prev) => {
        const combined = [...prev, ...validFiles]
        if (combined.length > 3) {
          show('You can only attach up to 3 images.', 'error')
          return combined.slice(0, 3)
        }
        return combined
      })
    }
    event.target.value = ''
  }

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index))
  }

  async function submitReply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!message.trim()) return

    try {
      const formData = new FormData()
      formData.append('message', message.trim())
      for (const file of attachments) {
        formData.append('attachments', file)
      }

      await replyMutation.mutateAsync({ ticketId, formData })
      setMessage('')
      setAttachments([])
    } catch (error) {
      show(error instanceof Error ? error.message : 'Could not send reply.', 'error')
    }
  }
  
  async function handleReopen() {
    try {
      await reopenMutation.mutateAsync(ticketId)
      show('Ticket reopened successfully.', 'success')
    } catch (error) {
      show(error instanceof Error ? error.message : 'Could not reopen ticket.', 'error')
    }
  }

  const handleAttachmentClick = async (storageKey: string) => {
    try {
      const res = await supportTicketsApi.getAttachmentUrl(ticketId, storageKey)
      window.open(res.url, '_blank')
    } catch {
      show('Could not open attachment.', 'error')
    }
  }

  return (
    <Dialog title={data ? `Ticket: ${data.ticket.subject}` : 'Support Ticket'} onClose={onClose}>
      {isPending ? (
        <div style={{ padding: '2rem', textAlign: 'center' }}>Loading conversation...</div>
      ) : isError ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--error)' }}>Failed to load conversation.</div>
      ) : data ? (
        <div style={{ display: 'flex', flexDirection: 'column', height: '60vh', minHeight: '400px' }}>
          <div style={{ flex: 1, overflowY: 'auto', paddingRight: '10px', display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1rem' }}>
            {data.messages.map((msg) => {
              const isUser = msg.senderRole === 'USER'
              return (
                <div key={msg.id} style={{ alignSelf: isUser ? 'flex-end' : 'flex-start', maxWidth: '80%', background: isUser ? 'var(--primary)' : 'var(--surface-hover)', color: isUser ? '#fff' : 'inherit', padding: '1rem', borderRadius: '12px', borderBottomRightRadius: isUser ? '2px' : '12px', borderBottomLeftRadius: !isUser ? '2px' : '12px' }}>
                  <div style={{ fontSize: '0.8rem', opacity: 0.8, marginBottom: '0.5rem', fontWeight: 600 }}>
                    {isUser ? 'You' : 'Support Team'} &middot; {new Date(msg.createdAt).toLocaleString()}
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{msg.message}</div>
                  
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {msg.attachments.map((att) => (
                        <button key={att.storageKey} onClick={() => handleAttachmentClick(att.storageKey)} style={{ background: 'rgba(0,0,0,0.1)', border: 'none', padding: '0.25rem 0.5rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', color: 'inherit', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Paperclip size={12} /> {att.originalName}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          
          {data.ticket.status === 'RESOLVED' ? (
            <div style={{ textAlign: 'center', padding: '1rem', background: 'var(--surface-hover)', borderRadius: '8px' }}>
              <p style={{ margin: '0 0 1rem 0' }}>This ticket has been marked as resolved.</p>
              <button className="secondary-button" onClick={handleReopen} disabled={reopenMutation.isPending}>
                {reopenMutation.isPending ? 'Reopening...' : 'Reopen Ticket'}
              </button>
            </div>
          ) : (
            <form onSubmit={submitReply} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
              <textarea 
                className="text-input" 
                placeholder="Type your reply..." 
                value={message} 
                onChange={e => setMessage(e.target.value)}
                required
                minLength={2}
                maxLength={5000}
                style={{ resize: 'vertical', minHeight: '80px' }}
              />
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  {attachments.length > 0 && (
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                      {attachments.map((file, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'var(--surface-hover)', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem' }}>
                          <span>{file.name}</span>
                          <button type="button" onClick={() => removeAttachment(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}><X size={12}/></button>
                        </div>
                      ))}
                    </div>
                  )}
                  {attachments.length < 3 && (
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--muted)' }}>
                      <Paperclip size={14} /> Attach Screenshot
                      <input type="file" multiple accept="image/jpeg, image/png, image/webp" onChange={handleFileChange} hidden />
                    </label>
                  )}
                </div>
                <button type="submit" className="primary-button" disabled={replyMutation.isPending} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Send size={16} /> {replyMutation.isPending ? 'Sending...' : 'Reply'}
                </button>
              </div>
            </form>
          )}
        </div>
      ) : null}
    </Dialog>
  )
}
