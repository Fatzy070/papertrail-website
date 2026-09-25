import { useState } from 'react'
import { ArrowLeft, CircleHelp, Send } from 'lucide-react'
import { Link } from 'react-router-dom'
import { type SupportTicketCategory } from '../api/support-tickets.api'
import { useCreateSupportTicket, useMySupportTickets } from '../hooks/use-support-tickets'
import { useToastStore } from '../store/toast-store'
import { WorkspaceSidebar } from '../components/dashboard/WorkspaceSidebar'

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

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    try {
      await createTicket.mutateAsync({ subject: subject.trim(), category, message: message.trim() })
      setSubject('')
      setCategory('GENERAL')
      setMessage('')
      show('Your support request has been submitted.', 'success')
    } catch (error) {
      show(error instanceof Error ? error.message : 'Could not send your request.', 'error')
    }
  }

  return (
    <main className="workspace-layout">
      <WorkspaceSidebar />
      <section className="workspace-main">
        <div className="workspace-content support-page">
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
              <button className="primary-button support-submit" disabled={createTicket.isPending}><Send size={16} />{createTicket.isPending ? 'Sending…' : 'Send message'}</button>
            </form>
            <section className="support-card">
              <h2>Your support requests</h2>
              {tickets.isPending ? <div className="support-list-skeleton"><div className="skeleton" /><div className="skeleton" /></div> : tickets.isError ? <div className="error-message">Could not load your requests. <button className="toolbar-button" onClick={() => void tickets.refetch()}>Try again</button></div> : !tickets.data?.length ? <div className="support-empty"><CircleHelp size={28} /><p>No support requests yet.</p><span className="muted">When you contact support, your requests will appear here.</span></div> : <div className="support-ticket-list">{tickets.data.map((ticket) => <article className="support-ticket" key={ticket.id}><div><strong>{ticket.subject}</strong><span>{ticket.reference} · {categoryLabel(ticket.category)}</span></div><div className={`status-badge status-${ticket.status.toLowerCase()}`}>{ticket.status.replace('_', ' ')}</div><time>{new Date(ticket.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</time></article>)}</div>}
            </section>
          </div>
        </div>
      </section>
    </main>
  )
}
