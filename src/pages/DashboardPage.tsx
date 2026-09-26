import { Link, useNavigate } from 'react-router-dom'
import {
  FileText,
  Clock3,
  Combine,
  Scissors,
  Minimize2,
  RefreshCw,
} from 'lucide-react'
import { useDocuments } from '../hooks/use-documents'
import { useCurrentUser } from '../hooks/use-auth'

export function DashboardPage() {
  const documents = useDocuments('recent')
  const user = useCurrentUser()
  const navigate = useNavigate()

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  }

  const recentDocs = documents.data?.slice(0, 4) ?? []

  return (
    <div className="workspace-content">
      <header className="">
        <div>
          <h1 className="text-[2rem] font-semibold tracking-tight text-slate-900 mb-2">{getGreeting()}, {user.data?.name?.split(' ')[0] ?? 'there'}</h1>
          <p className="text-slate-500  md:text-[16px] pb-3">Welcome back to your workspace.</p>
        </div>
      </header>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Clock3 size={16} /> Continue Editing
        </h2>
        {documents.isPending ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
            {[1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ height: '120px', borderRadius: '8px' }} />)}
          </div>
        ) : recentDocs.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
            {recentDocs.map(doc => (
              <button 
                key={doc.id}
                onClick={() => navigate(`/documents/${doc.id}/edit`)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  padding: '1rem',
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  gap: '0.5rem',
                  transition: 'border-color 0.2s',
                }}
                onMouseOver={e => (e.currentTarget.style.borderColor = 'var(--primary)')}
                onMouseOut={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              >
                <FileText size={24} style={{ color: 'var(--primary)' }} />
                <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
                  {doc.name}
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                  {new Date(doc.lastOpenedAt || doc.updatedAt).toLocaleDateString()}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="empty-state" style={{ padding: '2rem' }}>
            <p className="muted">No recent documents. Upload a PDF to get started.</p>
            <Link to="/documents" className="primary-button" style={{ display: 'inline-flex', marginTop: '1rem' }}>Go to My Documents</Link>
          </div>
        )}
      </section>

      <section>
        <h2 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Quick Tools</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
          {[
            { to: '/tools/merge', icon: Combine, title: 'Merge PDF', desc: 'Combine multiple PDFs into one.' },
            { to: '/tools/split', icon: Scissors, title: 'Split PDF', desc: 'Extract pages or split into multiple files.' },
            { to: '/tools/compress', icon: Minimize2, title: 'Compress PDF', desc: 'Reduce file size while keeping quality.' },
            { to: '/tools/convert', icon: RefreshCw, title: 'Convert PDF', desc: 'Convert to or from PDF format.' }
          ].map(tool => (
            <Link 
              key={tool.to}
              to={tool.to}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                padding: '1rem',
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                color: 'var(--foreground)',
                textDecoration: 'none',
              }}
            >
              <div style={{ padding: '0.75rem', backgroundColor: 'var(--surface-hover)', borderRadius: '8px', color: 'var(--primary)' }}>
                <tool.icon size={20} />
              </div>
              <div>
                <strong style={{ display: 'block', fontSize: '0.95rem' }}>{tool.title}</strong>
                <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{tool.desc}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
