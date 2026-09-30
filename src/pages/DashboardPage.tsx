import { Link, useNavigate } from 'react-router-dom'
import { ArrowUpRight, FileText, Clock3, Combine, Scissors, Minimize2, RefreshCw, FolderOpen } from 'lucide-react'
import { useDocuments } from '../hooks/use-documents'
import { useCurrentUser } from '../hooks/use-auth'
import { PageHeading } from '../components/ui/PageHeading'

export function DashboardPage() {
  const documents = useDocuments('recent')
  const user = useCurrentUser()
  const navigate = useNavigate()
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const recentDocs = documents.data?.slice(0, 4) ?? []

  return <div className="workspace-content dashboard-page">
    <PageHeading eyebrow="YOUR WORKSPACE" title={`${greeting}, ${user.data?.name?.split(' ')[0] ?? 'there'}.`} description="A clear space for your next piece of work." action={<Link className="toolbar-button bordered" to="/documents"><FolderOpen size={16} /> My documents <ArrowUpRight size={15} /></Link>} />
    <div className="workspace-invitation"><div><p className="eyebrow">PICK UP A PDF. MAKE IT YOURS.</p><h2>Big ideas.<br />Small finishing touches.</h2><p>Edit, organize, and get your documents ready to go.</p><Link to="/documents" className="primary-button">Open your library <ArrowUpRight size={16} /></Link></div><div className="invitation-art" aria-hidden="true"><div className="invitation-sheet"><FileText size={28} /><span>A WORK<br />IN PROGRESS.</span><i /><i /><i /><small>PAPERTRAIL</small></div><span className="invitation-label">Ready for your next edit.</span></div></div>
    <section className="dashboard-section"><div className="section-title-row"><h2><Clock3 size={18} /> Continue where you left off</h2><Link to="/recent">View recent <ArrowUpRight size={14} /></Link></div>
      {documents.isPending ? <div className="recent-grid" aria-label="Loading recent documents">{[1,2,3,4].map(i => <div key={i} className="skeleton recent-skeleton" />)}</div> : documents.isError ? <div className="error-message" role="alert">We couldn't load your recent documents. <button className="toolbar-button" onClick={() => void documents.refetch()}>Try again</button></div> : recentDocs.length ? <div className="recent-grid">{recentDocs.map(doc => <button key={doc.id} className="recent-document" onClick={() => navigate(`/documents/${doc.id}/edit`)}><div className="document-cover"><FileText size={32} /><span>PDF</span></div><div className="recent-document-info"><strong>{doc.name}</strong><span>{new Date(doc.lastOpenedAt || doc.updatedAt).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}</span><ArrowUpRight size={16} /></div></button>)}</div> : <div className="empty-state"><FolderOpen size={30} /><h3>Your next edit starts here.</h3><p className="muted">Open or upload a PDF in your library to get started.</p><Link className="toolbar-button bordered" to="/documents">Go to My Documents <ArrowUpRight size={15} /></Link></div>}
    </section>
    <section className="dashboard-section"><div className="section-title-row"><h2>Your PDF toolkit</h2><Link to="/tools">All PDF tools <ArrowUpRight size={14} /></Link></div><div className="workspace-tool-grid">{[
      { to:'/tools/merge',icon:Combine,title:'Merge PDF',desc:'Bring your files together.' },
      { to:'/tools/split',icon:Scissors,title:'Split & extract',desc:'Just the pages you need.' },
      { to:'/tools/compress',icon:Minimize2,title:'Compress PDF',desc:'A lighter file for sharing.' },
      { to:'/tools/convert',icon:RefreshCw,title:'Convert PDF',desc:'PDF to images. Images to PDF.' },
    ].map(({icon:Icon,...tool}) => <Link className="workspace-tool" key={tool.to} to={tool.to}><Icon size={23} /><strong>{tool.title}</strong><p>{tool.desc}</p><ArrowUpRight size={16} /></Link>)}</div></section>
  </div>
}
