import { useState } from 'react'
import { ArrowLeft, CircleHelp, Send, Paperclip, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { type SupportTicketCategory } from '../api/support-tickets.api'
import { useCreateSupportTicket, useMySupportTickets } from '../hooks/use-support-tickets'
import { useToastStore } from '../store/toast-store'
import { AccountNavigation } from '../components/ui/AccountNavigation'
import { SupportThreadModal } from '../components/support/SupportThreadModal'

const categories: Array<{ value: SupportTicketCategory; label: string }> = [
  { value: 'GENERAL', label: 'General question' },
  { value: 'ACCOUNT', label: 'Account' },
  { value: 'PDF_EDITOR', label: 'PDF editing' },
  { value: 'DOCUMENT_UPLOAD', label: 'Document upload' },
  { value: 'DOCUMENT_STORAGE', label: 'Document storage' },
  { value: 'BUG', label: 'Bug report' },
  { value: 'FEATURE_REQUEST', label: 'Feature request' },
  { value: 'OTHER', label: 'Other' },
]

const categoryLabel = (value: SupportTicketCategory) => categories.find((item) => item.value === value)?.label ?? value

export function SupportPage() {
  const createTicket = useCreateSupportTicket()
  const tickets = useMySupportTickets()
  const show = useToastStore((state) => state.show)
  const [subject, setSubject] = useState('')
  const [category, setCategory] = useState<SupportTicketCategory>('GENERAL')
  const [message, setMessage] = useState('')
  const [attachments, setAttachments] = useState<File[]>([])
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null)

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

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    try {
      const formData = new FormData()
      formData.append('subject', subject.trim())
      formData.append('category', category)
      formData.append('message', message.trim())
      for (const file of attachments) {
        formData.append('attachments', file)
      }

      await createTicket.mutateAsync(formData)
      setSubject('')
      setCategory('GENERAL')
      setMessage('')
      setAttachments([])
      show('Your support request has been submitted.', 'success')
    } catch (error) {
      show(error instanceof Error ? error.message : 'Could not send your request.', 'error')
    }
  }

  return (
    <>
        <div className="workspace-content support-page">
          <AccountNavigation support />
          <Link className="text-link" to="/dashboard"><ArrowLeft size={15} /> Back to home</Link>
          <header className="workspace-heading support-heading">
            <div><div className="eyebrow"><CircleHelp size={15} /> Help &amp; Feedback</div><h1>How can we help?</h1><p className="muted">Send our support team a message and we&apos;ll get back to you.</p></div>
          </header>
          <div className="support-grid">
            <form className="support-card" onSubmit={submit}>
              <h2>Contact support</h2>
              <label className="field-label">Subject<input className="text-input" minLength={3} maxLength={150} required value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="What do you need help with?" /></label>
              <label className="field-label">Category<select className="text-input" value={category} onChange={(event) => setCategory(event.target.value as SupportTicketCategory)}>{categories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
              <label className="field-label">Message<textarea className="text-input support-textarea" minLength={10} maxLength={5000} required value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Tell us what happened..." /></label>
              
              <div className="support-attachments-section">
                {attachments.length > 0 && (
                  <div className="support-attachments-list">
                    {attachments.map((file, i) => (
                      <div key={i} className="support-attachment-item">
                        <span className="attachment-name">{file.name}</span>
                        <button type="button" className="attachment-remove-btn" onClick={() => removeAttachment(i)} aria-label="Remove"><X size={14}/></button>
                      </div>
                    ))}
                  </div>
                )}
                {attachments.length < 3 && (
                  <label className="secondary-button support-attach-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <Paperclip size={16} /> Attach Screenshot
                    <input type="file" multiple accept="image/jpeg, image/png, image/webp" onChange={handleFileChange} hidden />
                  </label>
                )}
                <p className="muted" style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>Max 3 images (PNG, JPG, WebP), 5MB each.</p>
              </div>

              <button className="primary-button support-submit" disabled={createTicket.isPending} style={{ marginTop: '1rem' }}><Send size={16} />{createTicket.isPending ? 'Sending…' : 'Send message'}</button>
            </form>
            <section className="support-card">
              <h2>Your support requests</h2>
              {tickets.isPending ? <div className="support-list-skeleton"><div className="skeleton" /><div className="skeleton" /></div> : tickets.isError ? <div className="error-message">Could not load your requests. <button className="toolbar-button" onClick={() => void tickets.refetch()}>Try again</button></div> : !tickets.data?.length ? <div className="support-empty"><CircleHelp size={28} /><p>No support requests yet.</p><span className="muted">When you contact support, your requests will appear here.</span></div> : <div className="support-ticket-list">{tickets.data.map((ticket) => <article className="support-ticket" key={ticket.id} onClick={() => setActiveTicketId(ticket.id)} style={{ cursor: 'pointer' }}><div><strong>{ticket.subject}</strong><span>{ticket.reference} · {categoryLabel(ticket.category)}</span></div><div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><div className={`status-badge status-${ticket.status.toLowerCase()}`}>{ticket.status.replace('_', ' ')}</div>{ticket.userUnreadCount ? <span style={{ background: 'var(--primary)', color: 'white', padding: '0.1rem 0.4rem', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 'bold' }}>{ticket.userUnreadCount}</span> : null}</div><time>{new Date(ticket.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</time></article>)}</div>}
            </section>
          </div>
        </div>
        {activeTicketId && <SupportThreadModal ticketId={activeTicketId} onClose={() => setActiveTicketId(null)} />}
    </>
  )
}
