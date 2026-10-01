import { PageHeading } from '../../components/ui/PageHeading'
import { ToolCatalog } from '../../components/tools/ToolCatalog'

export function ToolsPage() {
  return <div className="workspace-content tools-directory"><PageHeading eyebrow="THE PAPERTRAIL TOOLKIT" title="A tool for the next step." description="Edit a document, arrange its pages, or give it a new format."/><ToolCatalog/><p className="catalog-note">Editing, signing, and watermarking start by opening a document in your library.</p></div>
}
