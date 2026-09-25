import { ArrowLeft, Clock3, FileOutput, Files, Minimize2, Scissors, Star, Trash2 } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
const pageCopy: Record<string, { title: string; description: string; icon: typeof Files }> = {
  '/recent': { title: 'Recent', description: 'Recently opened documents will appear here.', icon: Clock3 },
  '/starred': { title: 'Starred', description: 'Star important documents to find them quickly.', icon: Star },
  '/trash': { title: 'Trash', description: 'Deleted documents will appear here when this workspace is ready.', icon: Trash2 },
  '/tools/merge': { title: 'Merge PDF', description: 'Combine multiple PDFs into one document.', icon: Files },
  '/tools/split': { title: 'Split / Extract Pages', description: 'Create smaller PDFs from selected pages.', icon: Scissors },
  '/tools/compress': { title: 'Compress PDF', description: 'Reduce PDF size while keeping your documents readable.', icon: Minimize2 },
  '/tools/convert': { title: 'Convert PDF', description: 'Conversion tools are coming soon.', icon: FileOutput },
}

export function WorkspacePlaceholderPage() {
  const location = useLocation()
  const copy = pageCopy[location.pathname] ?? pageCopy['/recent']
  const Icon = copy.icon
  return (
    <>
        <div className="workspace-content centered-empty-page">
          <Link className="text-link" to="/dashboard"><ArrowLeft size={15} /> Back to home</Link>
          <div className="empty-state">
            <Icon size={36} />
            <h1>{copy.title}</h1>
            <p className="muted">{copy.description}</p>
            <span className="coming-soon-badge">Coming soon</span>
          </div>
        </div>
    </>
  )
}
