import { useState, useMemo } from 'react'
import { useDropzone } from 'react-dropzone'
import {
  FileText,
  FolderOpen,
  Search,
  UploadCloud,
} from 'lucide-react'
import { Dialog } from '../components/ui/Dialog'
import { DocumentActions } from '../components/DocumentActions'
import { useNavigate } from 'react-router-dom'
import { documentsApi, type DocumentMetadata } from '../api/documents.api'
import {
  useDeleteDocument,
  useDocuments,
  useRenameDocument,
  useUpdateDocument,
  useUploadDocument,
} from '../hooks/use-documents'
import { useToastStore } from '../store/toast-store'

const maxBytes = 50 * 1024 * 1024
const formatSize = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`

export function DocumentsPage({ filter = 'all' }: { filter?: 'all' | 'recent' | 'starred' | 'trash' }) {
  const documents = useDocuments(filter)
  const upload = useUploadDocument()
  const rename = useRenameDocument()
  const update = useUpdateDocument()
  const remove = useDeleteDocument()
  const navigate = useNavigate()
  const show = useToastStore((state) => state.show)
  const [renaming, setRenaming] = useState<DocumentMetadata | null>(null)
  const [newName, setNewName] = useState('')
  const [search, setSearch] = useState('')
  const [deleting, setDeleting] = useState<DocumentMetadata | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  async function uploadFile(file?: File) {
    if (!file || upload.isPending) return
    if (
      file.size > maxBytes ||
      (!file.name.toLowerCase().endsWith('.pdf') &&
        file.type !== 'application/pdf')
    ) {
      show('Choose a PDF no larger than 50 MB.', 'error')
      return
    }
    try {
      await upload.mutateAsync(file)
      show('PDF uploaded successfully.', 'success')
    } catch (cause) {
      show(cause instanceof Error ? cause.message : 'Upload failed.', 'error')
    }
  }
  const dropzone = useDropzone({
    accept: { 'application/pdf': ['.pdf'] },
    maxSize: maxBytes,
    multiple: false,
    disabled: upload.isPending,
    onDrop: (files) => void uploadFile(files[0]),
    onDropRejected: () => show('Choose a PDF no larger than 50 MB.', 'error'),
  })
  async function download(id: string) {
    try {
      const url = documentsApi.contentUrl(id)
      window.location.assign(url)
    } catch (cause) {
      show(cause instanceof Error ? cause.message : 'Download failed.', 'error')
    }
  }
  async function deleteDocument(document: DocumentMetadata) {
    try {
      if (filter === 'trash') {
        await remove.mutateAsync(document.id)
        show('Document permanently deleted.', 'success')
      } else {
        await update.mutateAsync({ id: document.id, updates: { isDeleted: true } })
        show('Moved to trash.', 'success')
      }
      setDeleting(null)
    } catch (cause) {
      show(cause instanceof Error ? cause.message : 'Delete failed.', 'error')
    }
  }
  async function toggleStar(document: DocumentMetadata) {
    try {
      await update.mutateAsync({ id: document.id, updates: { isStarred: !document.isStarred } })
    } catch {
      show('Could not update star status.', 'error')
    }
  }
  async function restoreDocument(document: DocumentMetadata) {
    try {
      await update.mutateAsync({ id: document.id, updates: { restore: true } })
      show('Document restored.', 'success')
    } catch {
      show('Could not restore document.', 'error')
    }
  }
  async function submitRename() {
    if (!renaming || !newName.trim()) return
    try {
      await rename.mutateAsync({ id: renaming.id, name: newName.trim() })
      setRenaming(null)
      show('Document renamed.', 'success')
    } catch (cause) {
      show(cause instanceof Error ? cause.message : 'Rename failed.', 'error')
    }
  }
  const filtered =
    documents.data?.filter((document) =>
      document.name.toLowerCase().includes(search.toLowerCase()),
    ) ?? []
  const pageInfo = useMemo(() => {
    switch (filter) {
      case 'recent': return { title: 'Recent', description: 'Recently opened documents will appear here.', emptyTitle: 'No recent documents', emptyDesc: 'Open a document to see it here.' }
      case 'starred': return { title: 'Starred', description: 'Star important documents to find them quickly.', emptyTitle: 'No starred documents', emptyDesc: 'Click the star icon on any document to add it here.' }
      case 'trash': return { title: 'Trash', description: 'Deleted documents will appear here.', emptyTitle: 'Trash is empty', emptyDesc: 'Items in trash can be restored or permanently deleted.' }
      default: return { title: 'My documents', description: 'A place for your PDFs. Ready for your next edit.', emptyTitle: 'Your next edit starts here', emptyDesc: 'Upload your first PDF to start making it your own.' }
    }
  }, [filter])

  return (
    <>
      <div className="max-w-7xl mx-auto p-8 w-full">
          <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-1">{pageInfo.title}</h1>
              <p className="text-slate-500 text-sm">
                {pageInfo.description}
              </p>
            </div>
            {filter === 'all' && (
              <button
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl shadow-sm transition-all hover:shadow-md active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                disabled={upload.isPending}
                onClick={dropzone.open}
              >
                <UploadCloud size={16} />
                {upload.isPending ? 'Uploading…' : 'Upload PDF'}
              </button>
            )}
          </header>
          
          {filter === 'all' && (
            <div
              {...dropzone.getRootProps()}
              className={`relative flex flex-col items-center justify-center p-10 mb-8 border-2 border-dashed rounded-3xl transition-all cursor-pointer group ${
                dropzone.isDragActive 
                  ? 'border-blue-500 bg-blue-50 ring-4 ring-blue-500/20' 
                  : 'border-slate-300 bg-white hover:border-blue-400 hover:bg-slate-50 hover:shadow-sm'
              }`}
            >
              <input {...dropzone.getInputProps()} />
              <div className="bg-blue-100 text-blue-600 p-3 rounded-full mb-3 group-hover:scale-110 transition-transform">
                <UploadCloud size={24} />
              </div>
              <div className="text-base text-slate-700 text-center mb-1">
                <strong>
                  {upload.isPending
                    ? 'Uploading your document…'
                    : 'Drop a PDF here'}
                </strong>{' '}
                <span className="font-normal text-slate-500">or click to browse</span>
              </div>
              <span className="text-xs font-medium text-slate-400">PDF files · up to 50 MB</span>
            </div>
          )}
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{documents.data?.length ?? 0} documents</span>
            <label className="relative group flex items-center w-full sm:w-auto">
              <Search size={14} className="absolute left-3 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
              <input
                aria-label="Search documents"
                placeholder="Search documents…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 w-full sm:w-64 bg-white border border-slate-200 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none text-sm text-slate-900 placeholder:text-slate-400"
              />
            </label>
          </div>

          {documents.isPending ? (
            <div aria-label="Loading documents" className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div className="h-14 bg-slate-200/50 animate-pulse rounded-xl" key={i} />
              ))}
            </div>
          ) : documents.isError ? (
            <div className="flex items-center justify-between p-4 bg-red-50 text-red-700 border border-red-200 rounded-xl shadow-sm" role="alert">
              <span className="font-medium text-sm">Could not load your documents.</span>
              <button
                className="px-3 py-1.5 bg-white text-red-600 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors"
                onClick={() => void documents.refetch()}
              >
                Try again
              </button>
            </div>
          ) : !filtered.length ? (
            <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-3xl border border-slate-200 shadow-sm">
              <div className="bg-slate-100 text-slate-400 p-4 rounded-full mb-4">
                <FolderOpen size={32} />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">
                {search
                  ? 'No matching documents'
                  : pageInfo.emptyTitle}
              </h2>
              <p className="text-slate-500 text-sm mb-6 max-w-sm">
                {search
                  ? 'Try searching for a different filename.'
                  : pageInfo.emptyDesc}
              </p>
              {!search && filter === 'all' && (
                <button 
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl shadow-sm transition-all hover:shadow-md active:scale-95" 
                  onClick={dropzone.open}
                >
                  <UploadCloud size={16} /> Upload a PDF
                </button>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className='overflow-y-auto no-scrollbar'>
                <table className="w-full text-left border-collapse whitespace-nowrap">
                  <thead>
                    <tr>
                      <th className="px-5 py-3 text-[11px] font-bold tracking-wider text-slate-500 uppercase bg-slate-50/80 border-b border-slate-200">Name</th>
                      <th className="px-5 py-3 text-[11px] font-bold tracking-wider text-slate-500 uppercase bg-slate-50/80 border-b border-slate-200 hidden sm:table-cell">Updated</th>
                      <th className="px-5 py-3 text-[11px] font-bold tracking-wider text-slate-500 uppercase bg-slate-50/80 border-b border-slate-200 hidden md:table-cell">Pages</th>
                      <th className="px-5 py-3 text-[11px] font-bold tracking-wider text-slate-500 uppercase bg-slate-50/80 border-b border-slate-200 hidden sm:table-cell">Size</th>
                      <th className="px-5 py-3 border-b border-slate-200 bg-slate-50/80 w-16" aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtered.map((document) => (
                      <tr key={document.id} className="hover:bg-slate-50 transition-colors group">
                        <td className="px-5 py-3">
                          <button
                            className="flex items-center gap-3 text-slate-900 font-medium hover:text-blue-600 transition-colors text-left truncate max-w-xs md:max-w-md lg:max-w-lg"
                            onClick={() =>
                              navigate(`/documents/${document.id}/edit`)
                            }
                          >
                            <span className="flex items-center justify-center w-8 h-8 rounded-md bg-red-100 text-red-600 shrink-0 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                              <FileText size={16} />
                            </span>
                            <span title={document.name} className="truncate text-sm">{document.name}</span>
                          </button>
                        </td>
                        <td className="px-5 py-3 text-sm text-slate-500 hidden sm:table-cell">
                          {new Date(document.updatedAt).toLocaleDateString(
                            undefined,
                            { month: 'short', day: 'numeric', year: 'numeric' },
                          )}
                        </td>
                        <td className="px-5 py-3 text-sm text-slate-500 hidden md:table-cell">{document.pageCount ?? '—'}</td>
                        <td className="px-5 py-3 text-sm text-slate-500 hidden sm:table-cell">{formatSize(document.size)}</td>
                        <td className="px-5 py-3 text-right">
                          <DocumentActions
                            document={document}
                            filter={filter}
                            isOpen={openMenuId === document.id}
                            onToggle={() => setOpenMenuId(openMenuId === document.id ? null : document.id)}
                            onClose={() => setOpenMenuId(null)}
                            onRestore={restoreDocument}
                            onDeletePermanently={setDeleting}
                            onToggleStar={toggleStar}
                            onRename={(doc) => {
                              setRenaming(doc)
                              setNewName(doc.name)
                            }}
                            onDownload={download}
                            onDelete={setDeleting}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

      {renaming && (
        <Dialog
          title="Rename document"
          description="Choose a name that makes this PDF easy to find."
          onClose={() => setRenaming(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void submitRename()
            }}
            className="mt-5"
          >
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Document name
            </label>
            <input
              autoFocus
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all mb-5 text-slate-900"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                className="px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200 transition-colors"
                onClick={() => setRenaming(null)}
              >
                Cancel
              </button>
              <button
                className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
                disabled={rename.isPending || !newName.trim()}
              >
                Save name
              </button>
            </div>
          </form>
        </Dialog>
      )}
      {deleting && (
        <Dialog
          title={filter === 'trash' ? 'Delete permanently?' : 'Delete document?'}
          description={filter === 'trash' ? `“${deleting.name}” and its version history will be permanently deleted.` : `“${deleting.name}” will be moved to the trash.`}
          onClose={() => setDeleting(null)}
        >
          <div className="flex justify-end gap-2 pt-5 mt-2 border-t border-slate-100">
            <button
              className="px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200 transition-colors"
              onClick={() => setDeleting(null)}
            >
              Cancel
            </button>
            <button
              className="px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
              disabled={remove.isPending}
              onClick={() => void deleteDocument(deleting)}
            >
              {remove.isPending || update.isPending ? 'Deleting…' : filter === 'trash' ? 'Delete permanently' : 'Delete'}
            </button>
          </div>
        </Dialog>
      )}
    </>
  )
}
