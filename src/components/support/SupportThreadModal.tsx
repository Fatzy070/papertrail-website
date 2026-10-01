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
        <div className="p-8 text-center">Loading conversation...</div>
      ) : isError ? (
        <div className="p-8 text-center text-[var(--error)]">Failed to load conversation.</div>
      ) : data ? (
        <div className="flex flex-col h-[60vh] min-h-[400px]">
          <div className="flex-1 overflow-y-auto pr-2.5 flex flex-col gap-4 mb-4">
            {data.messages.map((msg) => {
              const isUser = msg.senderRole === 'USER'
              return (
                <div key={msg.id} className={`max-w-[80%] p-4 rounded-xl ${isUser ? 'self-end bg-[var(--primary)] text-white rounded-br-sm' : 'self-start bg-[var(--surface-hover)] text-inherit rounded-bl-sm'}`}>
                  <div className="text-[0.8rem] opacity-80 mb-2 font-semibold">
                    {isUser ? 'You' : 'Support Team'} &middot; {new Date(msg.createdAt).toLocaleString()}
                  </div>
                  <div className="whitespace-pre-wrap leading-relaxed">{msg.message}</div>
                  
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="mt-3 flex gap-2 flex-wrap">
                      {msg.attachments.map((att) => (
                        <button key={att.storageKey} onClick={() => handleAttachmentClick(att.storageKey)} className="bg-black/10 dark:bg-white/10 border-none py-1 px-2 rounded cursor-pointer text-[0.8rem] text-inherit flex items-center gap-1">
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
            <div className="text-center p-4 bg-[var(--surface-hover)] rounded-lg">
              <p className="m-0 mb-4">This ticket has been marked as resolved.</p>
              <button className="secondary-button" onClick={handleReopen} disabled={reopenMutation.isPending}>
                {reopenMutation.isPending ? 'Reopening...' : 'Reopen Ticket'}
              </button>
            </div>
          ) : (
            <form onSubmit={submitReply} className="flex flex-col gap-2 border-t border-[var(--border)] pt-4">
              <textarea 
                className="text-input resize-y min-h-[80px]" 
                placeholder="Type your reply..." 
                value={message} 
                onChange={e => setMessage(e.target.value)}
                required
                minLength={2}
                maxLength={5000}
              />
              
              <div className="flex justify-between items-start mt-1">
                <div>
                  {attachments.length > 0 && (
                    <div className="flex gap-2 flex-wrap mb-2">
                      {attachments.map((file, i) => (
                        <div key={i} className="flex items-center gap-1 bg-[var(--surface-hover)] py-1 px-2 rounded text-[0.8rem]">
                          <span>{file.name}</span>
                          <button type="button" onClick={() => removeAttachment(i)} className="bg-transparent border-none cursor-pointer p-0 flex"><X size={12}/></button>
                        </div>
                      ))}
                    </div>
                  )}
                  {attachments.length < 3 && (
                    <label className="inline-flex items-center gap-2 cursor-pointer text-[0.9rem] text-[var(--muted)]">
                      <Paperclip size={14} /> Attach Screenshot
                      <input type="file" multiple accept="image/jpeg, image/png, image/webp" onChange={handleFileChange} hidden />
                    </label>
                  )}
                </div>
                <button type="submit" className="primary-button flex items-center gap-2" disabled={replyMutation.isPending}>
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
