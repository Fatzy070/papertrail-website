import { useState } from 'react'
import { useDropzone } from 'react-dropzone'
import {
  Download,
  FileText,
  FolderOpen,
  MoreHorizontal,
  Search,
  Pencil,
  Trash2,
  UploadCloud,
} from 'lucide-react'
import { Dialog } from '../components/ui/Dialog'
import { useNavigate } from 'react-router-dom'
import { documentsApi, type DocumentMetadata } from '../api/documents.api'
import {
  useDeleteDocument,
  useDocuments,
  useRenameDocument,
  useUploadDocument,
} from '../hooks/use-documents'
import { useToastStore } from '../store/toast-store'

const maxBytes = 50 * 1024 * 1024
const formatSize = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`

export function DashboardPage() {
  const documents = useDocuments()
  const upload = useUploadDocument()
  const rename = useRenameDocument()
  const remove = useDeleteDocument()
  const navigate = useNavigate()
  const show = useToastStore((state) => state.show)
  const [renaming, setRenaming] = useState<DocumentMetadata | null>(null)
  const [newName, setNewName] = useState('')
  const [search, setSearch] = useState('')
  const [deleting, setDeleting] = useState<DocumentMetadata | null>(null)
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
      await remove.mutateAsync(document.id)
      setDeleting(null)
      show('Document deleted.', 'success')
    } catch (cause) {
      show(cause instanceof Error ? cause.message : 'Delete failed.', 'error')
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
  return (
    <>
      <div className="workspace-content">
          <header className="workspace-heading">
            <div>
              <h1>My documents</h1>
              <p className="muted">
                A place for your PDFs. Ready for your next edit.
              </p>
            </div>
            <button
              className="primary-button"
              disabled={upload.isPending}
              onClick={dropzone.open}
            >
              <UploadCloud size={16} />
              {upload.isPending ? 'Uploading…' : 'Upload PDF'}
            </button>
          </header>
          <div
            {...dropzone.getRootProps()}
            className={
              dropzone.isDragActive ? 'upload-strip dragging' : 'upload-strip'
            }
          >
            <input {...dropzone.getInputProps()} />
            <UploadCloud size={20} />
            <div>
              <strong>
                {upload.isPending
                  ? 'Uploading your document…'
                  : 'Drop a PDF here'}
              </strong>{' '}
              or click to browse
            </div>
            <span>PDF files · up to 50 MB</span>
          </div>
          <div className="document-controls">
            <span>{documents.data?.length ?? 0} documents</span>
            <label className="search-field">
              <Search size={15} />
              <input
                aria-label="Search documents"
                placeholder="Search documents…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
          </div>
          {documents.isPending ? (
            <div aria-label="Loading documents">
              {[1, 2, 3, 4].map((i) => (
                <div className="skeleton" key={i} />
              ))}
            </div>
          ) : documents.isError ? (
            <div className="error-message" role="alert">
              Could not load your documents.{' '}
              <button
                className="toolbar-button"
                onClick={() => void documents.refetch()}
              >
                Try again
              </button>
            </div>
          ) : !filtered.length ? (
            <div className="empty-state">
              <FolderOpen size={35} />
              <h2>
                {search
                  ? 'No matching documents'
                  : 'Your next edit starts here'}
              </h2>
              <p className="muted">
                {search
                  ? 'Try searching for a different filename.'
                  : 'Upload your first PDF to start making it your own.'}
              </p>
              {!search && (
                <button className="primary-button" onClick={dropzone.open}>
                  <UploadCloud size={16} /> Upload a PDF
                </button>
              )}
            </div>
          ) : (
            <table className="document-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th className="hide-mobile">Updated</th>
                  <th className="hide-tablet">Pages</th>
                  <th className="hide-mobile">Size</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((document) => (
                  <tr key={document.id}>
                    <td>
                      <button
                        className="file-name"
                        onClick={() =>
                          navigate(`/documents/${document.id}/edit`)
                        }
                      >
                        <span className="pdf-icon">
                          <FileText size={19} />
                        </span>
                        <span title={document.name}>{document.name}</span>
                      </button>
                    </td>
                    <td className="hide-mobile">
                      {new Date(document.updatedAt).toLocaleDateString(
                        undefined,
                        { month: 'short', day: 'numeric', year: 'numeric' },
                      )}
                    </td>
                    <td className="hide-tablet">{document.pageCount ?? '—'}</td>
                    <td className="hide-mobile">{formatSize(document.size)}</td>
                    <td>
                      <details className="file-menu">
                        <summary
                          className="icon-button"
                          aria-label={`Actions for ${document.name}`}
                        >
                          <MoreHorizontal size={18} />
                        </summary>
                        <div className="file-menu-list">
                          <button
                            onClick={(e) => {
                              e.currentTarget
                                .closest('details')
                                ?.removeAttribute('open')
                              setRenaming(document)
                              setNewName(document.name)
                            }}
                          >
                            <Pencil size={14} /> Rename
                          </button>
                          <button onClick={() => void download(document.id)}>
                            <Download size={14} /> Download
                          </button>
                          <button
                            onClick={(e) => {
                              e.currentTarget
                                .closest('details')
                                ?.removeAttribute('open')
                              setDeleting(document)
                            }}
                          >
                            <Trash2 size={14} /> Delete
                          </button>
                        </div>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
          >
            <label className="field-label">
              Document name
              <input
                autoFocus
                className="text-input"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </label>
            <div className="dialog-actions">
              <button
                type="button"
                className="toolbar-button bordered"
                onClick={() => setRenaming(null)}
              >
                Cancel
              </button>
              <button
                className="primary-button"
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
          title="Delete document?"
          description={`“${deleting.name}” and its version history will be permanently deleted.`}
          onClose={() => setDeleting(null)}
        >
          <div className="dialog-actions">
            <button
              className="toolbar-button bordered"
              onClick={() => setDeleting(null)}
            >
              Cancel
            </button>
            <button
              className="danger-button"
              disabled={remove.isPending}
              onClick={() => void deleteDocument(deleting)}
            >
              {remove.isPending ? 'Deleting…' : 'Delete document'}
            </button>
          </div>
        </Dialog>
      )}
    </>
  )
}
