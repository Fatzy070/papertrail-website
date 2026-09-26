import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageSidebar } from '../components/editor/PageSidebar'
import { PropertyPanel } from '../components/editor/PropertyPanel'
import { Dialog } from '../components/ui/Dialog'
import { LoadingState } from '../components/ui/LoadingState'
import { documentsApi } from '../api/documents.api'
import { apiFetchRaw } from '../api/client'
import { EditorToolbar } from '../components/editor/EditorToolbar'
import { PdfPage } from '../components/editor/PdfPage'
import { VersionHistory } from '../components/editor/VersionHistory'
import { WatermarkModal } from '../components/editor/WatermarkModal'
import { exportPdf } from '../engine/pdf-exporter'
import { loadPdfDocument } from '../engine/pdf-loader'
import { pdfCache } from '../engine/pdf-cache'
import { useDocument, useSaveDocument, useUpdateDocument } from '../hooks/use-documents'
import { usePdfEditor } from '../hooks/use-pdf-editor'
import { useEditorStore } from '../store/editor-store'
import { useToastStore } from '../store/toast-store'
import { useEditorKeyboardShortcuts } from '../hooks/use-editor-keyboard-shortcuts'

export function EditorPage() {
  const { documentId = '' } = useParams()
  const navigate = useNavigate()
  const metadata = useDocument(documentId)
  const saveMutation = useSaveDocument()
  const updateMutation = useUpdateDocument()
  const { pdf, openBytes, loading, error } = usePdfEditor()
  const loaded = useRef(false)
  const [history, setHistory] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const document = useEditorStore((s) => s.document)
  const elements = useEditorStore((s) => s.elements)
  const dirty = useEditorStore((s) => s.dirty)
  const markSaved = useEditorStore((s) => s.markSaved)
  const reset = useEditorStore((s) => s.reset)
  const show = useToastStore((s) => s.show)
  const [activePage, setActivePage] = useState(0)
  const [leaving, setLeaving] = useState(false)
  const [showWatermarkModal, setShowWatermarkModal] = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const pdfInputRef = useRef<HTMLInputElement>(null)
  const importTargetIndexRef = useRef<number>(0)

  useEditorKeyboardShortcuts()

  async function handleImportPdf(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.type !== 'application/pdf') {
      show('Unsupported format. Please use PDF.', 'error')
      e.target.value = ''
      return
    }

    try {
      const arrayBuffer = await file.arrayBuffer()
      const proxy = await loadPdfDocument(arrayBuffer)
      
      const sourceDocumentId = crypto.randomUUID()
      pdfCache.set(sourceDocumentId, { bytes: arrayBuffer, proxy })
      
      const newPages = []
      for (let i = 0; i < proxy.numPages; i++) {
        const page = await proxy.getPage(i + 1)
        const viewport = page.getViewport({ scale: 1 })
        newPages.push({
          id: crypto.randomUUID(),
          kind: 'imported' as const,
          sourceDocumentId,
          sourcePageIndex: i,
          width: viewport.width,
          height: viewport.height,
          rotation: page.rotate
        })
      }
      
      useEditorStore.getState().addPages(importTargetIndexRef.current, newPages)
      show(`Imported ${proxy.numPages} page(s)`, 'success')
    } catch (err) {
      show('Failed to import PDF', 'error')
      console.error(err)
    } finally {
      e.target.value = ''
    }
  }

  function handleAddImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      show('Unsupported image format. Please use PNG, JPEG, or WebP.', 'error')
      e.target.value = ''
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      show('Image is too large (max 10MB)', 'error')
      e.target.value = ''
      return
    }

    const src = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const activePageInfo = document?.pages[activePage]
      if (!activePageInfo) return
      
      const maxWidth = activePageInfo.width * 0.5
      const scale = img.width > maxWidth ? maxWidth / img.width : 1
      
      const width = img.width * scale
      const height = img.height * scale
      
      const x = (activePageInfo.width - width) / 2
      const y = (activePageInfo.height - height) / 2

      const id = crypto.randomUUID()
      useEditorStore.getState().addElement({
        type: 'image',
        id,
        pageId: activePageInfo.id,
        src,
        mimeType: file.type,
        source: 'user',
        x,
        y,
        width,
        height,
        rotation: 0
      })
      useEditorStore.getState().selectElement(id)
      useEditorStore.getState().setActiveTool('pointer')
    }
    img.onerror = () => {
      show('Failed to decode image', 'error')
      URL.revokeObjectURL(src)
    }
    img.src = src
    e.target.value = ''
  }
  const [fetching, setFetching] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  useEffect(() => {
    if (!metadata.data) return
    if (pdf && document?.name === metadata.data.name) { console.log("Init skipped because name matched"); return; }

    const controller = new AbortController()

    async function load() {
      setFetching(true)
      setFetchError(null)
      try {
        const response = await apiFetchRaw(`/documents/${documentId}/content`, { signal: controller.signal })
        if (!response.ok) throw new Error(`The PDF could not be downloaded (HTTP ${response.status}).`)
        
        const arrayBuffer = await response.arrayBuffer()
        if (controller.signal.aborted) return
        
        await openBytes(metadata.data!.name, arrayBuffer, {
          type: 'remote',
          documentId,
        })

        try {
          await updateMutation.mutateAsync({ 
            id: documentId, 
            updates: { lastOpenedAt: new Date().toISOString() } 
          })
        } catch (err) {
          console.error('Failed to update last opened at', err)
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return
        const message = err instanceof Error ? err.message : 'Unable to open PDF.'
        setFetchError(message)
        show(message, 'error')
      } finally {
        if (!controller.signal.aborted) {
          setFetching(false)
        }
      }
    }

    void load()

    return () => {
      controller.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId, metadata.data?.name, openBytes])
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault()
    }
    addEventListener('beforeunload', warn)
    return () => removeEventListener('beforeunload', warn)
  }, [dirty])
  useEffect(() => () => reset(), [reset])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (e.target instanceof HTMLElement) {
          const tag = e.target.tagName.toLowerCase()
          if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) {
            return
          }
        }
        useEditorStore.getState().deleteSelected()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
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
      console.log('[DEBUG] Calling markSaved')
      markSaved(bytes.buffer as ArrayBuffer)
      console.log('[DEBUG] markSaved completed')
      show('Document saved.', 'success')
    } catch (e) {
      setSaveError(true)
      show(e instanceof Error ? e.message : 'Save failed.', 'error')
    }
  }
  function back() {
    if (dirty) setLeaving(true)
    else navigate('/documents')
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
        onImageClick={() => imageInputRef.current?.click()}
        onWatermarkClick={() => setShowWatermarkModal(true)}
        saving={saveMutation.isPending}
        saveError={saveError}
      />
      <input 
        type="file" 
        accept="image/png,image/jpeg,image/webp" 
        style={{ display: 'none' }} 
        ref={imageInputRef}
        onChange={handleAddImage}
      />
      <input 
        type="file" 
        accept="application/pdf" 
        style={{ display: 'none' }} 
        ref={pdfInputRef}
        onChange={handleImportPdf}
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
          onImportFromFile={(index) => {
            importTargetIndexRef.current = index
            pdfInputRef.current?.click()
          }}
        />
        <section className="pdf-workspace" aria-label="Document canvas">
          <div className="pdf-pages">
            {(loading || metadata.isPending || fetching) && (
              <LoadingState label="Opening your PDF" />
            )}
            {(error || metadata.error || fetchError) && (
              <div className="error-message" role="alert">
                {error ?? fetchError ?? metadata.error?.message}
                <p>Return to your documents and try opening the PDF again.</p>
              </div>
            )}
            {document &&
              pdf &&
              document.pages.map((page, index) => (
                <div
                  key={page.id}
                  id={`pdf-page-${index}`}
                  onClick={() => setActivePage(index)}
                >
                  <p className="pdf-page-caption">
                    PAGE {index + 1} OF {document.pages.length}
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
              onClick={() => navigate('/documents')}
            >
              Discard changes
            </button>
          </div>
        </Dialog>
      )}
      {showWatermarkModal && (
        <WatermarkModal
          initialConfig={useEditorStore.getState().watermark}
          onClose={() => setShowWatermarkModal(false)}
          onSave={(config) => {
            useEditorStore.getState().setWatermark(config)
            setShowWatermarkModal(false)
          }}
          onRemove={() => {
            useEditorStore.getState().setWatermark(undefined)
            setShowWatermarkModal(false)
          }}
        />
      )}
    </main>
  )
}
