import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageSidebar } from '../components/editor/PageSidebar'
import { PropertyPanel } from '../components/editor/PropertyPanel'
import { Dialog } from '../components/ui/Dialog'
import { LoadingState } from '../components/ui/LoadingState'
import { documentsApi } from '../api/documents.api'
import { EditorToolbar } from '../components/editor/EditorToolbar'
import { PdfPage } from '../components/editor/PdfPage'
import { VersionHistory } from '../components/editor/VersionHistory'
import { exportPdf } from '../engine/pdf-exporter'
import { useDocument, useSaveDocument } from '../hooks/use-documents'
import { usePdfEditor } from '../hooks/use-pdf-editor'
import { useEditorStore } from '../store/editor-store'
import { useToastStore } from '../store/toast-store'
export function EditorPage() {
  const { documentId = '' } = useParams()
  const navigate = useNavigate()
  const metadata = useDocument(documentId)
  const saveMutation = useSaveDocument()
  const { pdf, openBytes, loading, error } = usePdfEditor()
  const loaded = useRef(false)
  const [history, setHistory] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const document = useEditorStore((s) => s.document)
  const elements = useEditorStore((s) => s.textElements)
  const dirty = useEditorStore((s) => s.dirty)
  const markSaved = useEditorStore((s) => s.markSaved)
  const reset = useEditorStore((s) => s.reset)
  const show = useToastStore((s) => s.show)
  const [activePage, setActivePage] = useState(0)
  const [leaving, setLeaving] = useState(false)
  const loadRemote = useCallback(async () => {
    if (!metadata.data) return
    const url = documentsApi.contentUrl(documentId)
    const response = await fetch(url, { credentials: 'include' })
    if (!response.ok) throw new Error('The PDF could not be downloaded.')
    await openBytes(metadata.data.name, await response.arrayBuffer(), {
      type: 'remote',
      documentId,
    })
  }, [documentId, metadata.data, openBytes])
  useEffect(() => {
    if (!metadata.data || loaded.current) return
    loaded.current = true
    void loadRemote().catch((e) =>
      show(e instanceof Error ? e.message : 'Unable to open PDF.', 'error'),
    )
  }, [metadata.data, loadRemote, show])
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault()
    }
    addEventListener('beforeunload', warn)
    return () => removeEventListener('beforeunload', warn)
  }, [dirty])
  useEffect(() => () => reset(), [reset])
  async function generate() {
    if (!document) throw new Error('No PDF is open.')
    return exportPdf(document, elements)
  }
  async function download() {
    try {
      const bytes = await generate()
      const url = URL.createObjectURL(
        new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' }),
      )
      const a = window.document.createElement('a')
      a.href = url
      a.download = document!.name.replace(/\.pdf$/i, '') + '-edited.pdf'
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (e) {
      show(e instanceof Error ? e.message : 'Export failed.', 'error')
    }
  }
  async function save() {
    setSaveError(false)
    try {
      const bytes = await generate()
      await saveMutation.mutateAsync({
        id: documentId,
        blob: new Blob([bytes.buffer as ArrayBuffer], {
          type: 'application/pdf',
        }),
      })
      markSaved(bytes.buffer as ArrayBuffer)
      show('Document saved.', 'success')
    } catch (e) {
      setSaveError(true)
      show(e instanceof Error ? e.message : 'Save failed.', 'error')
    }
  }
  function back() {
    if (dirty) setLeaving(true)
    else navigate('/dashboard')
  }
  async function restored() {
    loaded.current = false
    const result = await metadata.refetch()
    if (result.data) {
      const url = documentsApi.contentUrl(documentId)
      const response = await fetch(url, { credentials: 'include' })
      await openBytes(result.data.name, await response.arrayBuffer(), {
        type: 'remote',
        documentId,
      })
    }
  }
  return (
    <main className="editor-shell">
      <EditorToolbar
        onBack={back}
        onDownload={() => void download()}
        onSave={() => void save()}
        onVersions={() => setHistory(true)}
        saving={saveMutation.isPending}
        saveError={saveError}
      />
      <div className="editor-body">
        <PageSidebar
          pdf={pdf}
          pages={document?.pages ?? []}
          active={activePage}
          onSelect={(index) => {
            setActivePage(index)
            window.document
              .getElementById(`pdf-page-${index}`)
              ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }}
        />
        <section className="pdf-workspace" aria-label="Document canvas">
          <div className="pdf-pages">
            {(loading || metadata.isPending) && (
              <LoadingState label="Opening your PDF" />
            )}
            {(error || metadata.error) && (
              <div className="error-message" role="alert">
                {error ?? metadata.error?.message}
                <p>Return to your documents and try opening the PDF again.</p>
              </div>
            )}
            {document &&
              pdf &&
              document.pages.map((page) => (
                <div
                  key={page.index}
                  id={`pdf-page-${page.index}`}
                  onClick={() => setActivePage(page.index)}
                >
                  <p className="pdf-page-caption">
                    PAGE {page.index + 1} OF {document.pages.length}
                  </p>
                  <PdfPage pdf={pdf} page={page} />
                </div>
              ))}
          </div>
        </section>
        <PropertyPanel />
      </div>
      <footer className="editor-footer">
        <span>
          Page {activePage + 1} of {document?.pages.length ?? '—'}
        </span>
        <span>PDF document</span>
        <span>Double-click the page to add text</span>
      </footer>
      {history && (
        <VersionHistory
          documentId={documentId}
          onClose={() => setHistory(false)}
          onRestored={restored}
        />
      )}
      {leaving && (
        <Dialog
          title="Leave without saving?"
          description="Your latest changes haven't been saved. Stay here to save them, or discard them and return to your documents."
          onClose={() => setLeaving(false)}
        >
          <div className="dialog-actions">
            <button
              className="toolbar-button bordered"
              onClick={() => setLeaving(false)}
            >
              Keep editing
            </button>
            <button
              className="danger-button"
              onClick={() => navigate('/dashboard')}
            >
              Discard changes
            </button>
          </div>
        </Dialog>
      )}
    </main>
  )
}
