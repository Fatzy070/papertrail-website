import { memo, useEffect, useRef, useState } from 'react'
import { Copy, RotateCw, Trash2, X } from 'lucide-react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { EditorPage } from '../../types/editor'
import { useEditorStore } from '../../store/editor-store'
import { pdfCache } from '../../engine/pdf-cache'

const Thumbnail = memo(function Thumbnail({
  pdf,
  page,
  enabled,
}: {
  pdf: PDFDocumentProxy
  page: EditorPage
  enabled: boolean
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [nearViewport, setNearViewport] = useState(
    () => typeof IntersectionObserver === 'undefined',
  )

  useEffect(() => {
    if (!enabled || nearViewport) return
    const node = containerRef.current
    if (!node || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNearViewport(true)
          observer.disconnect()
        }
      },
      { rootMargin: '300px 0px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [enabled, nearViewport])

  useEffect(() => {
    if (!enabled || !nearViewport) return

    if (page.kind === 'blank') {
      if (canvasRef.current) {
        const scale = 112 / page.width
        canvasRef.current.width = Math.round(page.width * scale)
        canvasRef.current.height = Math.round(page.height * scale)
        const ctx = canvasRef.current.getContext('2d')
        if (ctx) {
          ctx.fillStyle = 'white'
          ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height)
        }
      }
      return
    }

    let cancelled = false
    let rafId = 0
    let task:
      | ReturnType<Awaited<ReturnType<PDFDocumentProxy['getPage']>>['render']>
      | undefined

    // Defer by one animation frame so the active main PdfPage enters the PDF.js worker queue first
    rafId = window.requestAnimationFrame(() => {
      if (cancelled) return

      let sourceProxy = pdf
      const sourcePageIndex =
        page.kind === 'imported'
          ? page.sourcePageIndex
          : page.kind === 'source'
            ? page.sourcePageIndex
            : 0

      if (page.kind === 'imported') {
        const cached = pdfCache.get(page.sourceDocumentId)
        if (cached) {
          sourceProxy = cached.proxy
        }
      }

      void sourceProxy
        .getPage(sourcePageIndex + 1)
        .then((value) => {
          if (cancelled || !canvasRef.current) return
          const dpr = Math.min(window.devicePixelRatio || 1, 2)
          const cssScale = 112 / page.width
          const viewport = value.getViewport({ scale: cssScale * dpr })
          canvasRef.current.width = Math.floor(viewport.width)
          canvasRef.current.height = Math.floor(viewport.height)
          task = value.render({ canvas: canvasRef.current, viewport })
          return task.promise
        })
        .catch(() => {})
    })

    return () => {
      cancelled = true
      window.cancelAnimationFrame(rafId)
      task?.cancel()
    }
  }, [pdf, page, enabled, nearViewport])

  const aspectHeight = Math.max(80, Math.round((112 * page.height) / Math.max(1, page.width)))

  return (
    <div ref={containerRef} style={{ minHeight: aspectHeight, width: '100%' }}>
      <canvas ref={canvasRef} />
    </div>
  )
})

export function PageSidebar({
  pdf,
  pages,
  active,
  onSelect,
  onDeletePage,
  onImportFromFile,
  mobileOpen = false,
  onMobileDismiss,
}: {
  pdf: PDFDocumentProxy | null
  pages: EditorPage[]
  active: number
  onSelect: (index: number) => void
  onDeletePage?: (index: number) => void
  onImportFromFile: (index: number) => void
  mobileOpen?: boolean
  onMobileDismiss?: () => void
}) {
  const [addPagesOpen, setAddPagesOpen] = useState(false)
  const [isMobileViewport, setIsMobileViewport] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(max-width: 980px)').matches
      : false,
  )
  const addPagesRef = useRef<HTMLDivElement>(null)
  // Insertion index for the top-level Add Pages button: append after last page
  const insertIndex = Math.max(0, pages.length - 1)
  const lastPage = pages[insertIndex]
  const canDeletePages = pages.length > 1
  const thumbnailsEnabled = !isMobileViewport || mobileOpen

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(max-width: 980px)')
    const onChange = (e: MediaQueryListEvent) => setIsMobileViewport(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!addPagesRef.current?.contains(event.target as Node)) setAddPagesOpen(false)
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setAddPagesOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [])

  function handleDelete(index: number) {
    if (!canDeletePages) return
    if (onDeletePage) {
      onDeletePage(index)
    } else {
      useEditorStore.getState().deletePage(index)
    }
  }

  return (
    <aside className={mobileOpen ? 'page-sidebar mobile-panel-open' : 'page-sidebar'}>
      {/* ── Sticky header with page count + Add Pages ── */}
      <div className="panel-heading flex items-center justify-between gap-1.5 sticky top-0 z-10 bg-[var(--sidebar-bg,#f8f9fa)]">
        <span>Pages <span className="count-badge">{pages.length}</span></span>

        <button type="button" className="mobile-panel-close" onClick={onMobileDismiss} aria-label="Close pages panel"><X size={18} /></button>

        <div ref={addPagesRef} className="relative">
          <button
            type="button"
            className="flex w-full items-center gap-1 text-xs px-2 py-1 rounded border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 whitespace-nowrap shadow-sm"
            title="Add pages"
            aria-haspopup="menu"
            aria-expanded={addPagesOpen}
            aria-controls="add-pages-menu"
            onClick={() => setAddPagesOpen((open) => !open)}
          >
            + Add pages <span className="text-[10px]">▾</span>
          </button>
          {addPagesOpen && <div id="add-pages-menu" role="menu" className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded shadow-lg min-w-max py-1 z-20">
            <button
              type="button"
              role="menuitem"
              className="w-full text-left px-3 py-1 text-sm text-gray-700 hover:bg-gray-100 whitespace-nowrap"
              onClick={(e) => {
                e.stopPropagation()
                useEditorStore.getState().addPage(insertIndex, {
                  id: crypto.randomUUID(),
                  kind: 'blank',
                  width: lastPage?.width ?? 595,
                  height: lastPage?.height ?? 842,
                  rotation: 0,
                })
                setAddPagesOpen(false)
              }}
            >
              Blank page
            </button>
            <button
              type="button"
              role="menuitem"
              className="w-full text-left px-3 py-1 text-sm text-gray-700 hover:bg-gray-100 whitespace-nowrap"
              onClick={(e) => {
                e.stopPropagation()
                onImportFromFile(insertIndex)
                setAddPagesOpen(false)
              }}
            >
              From file
            </button>
          </div>}
        </div>
      </div>

      {/* ── Scrollable thumbnail list ── */}
      <div className="thumbnail-list">
        {pages.map((page, i) => (
          <div
            key={page.id}
            className={active === i ? 'thumbnail-wrapper active' : 'thumbnail-wrapper'}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = 'move'
              e.dataTransfer.setData('text/plain', i.toString())
              e.currentTarget.style.opacity = '0.4'
            }}
            onDragEnd={(e) => {
              e.currentTarget.style.opacity = '1'
            }}
            onDragOver={(e) => {
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
            }}
            onDrop={(e) => {
              e.preventDefault()
              const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10)
              if (!isNaN(fromIndex) && fromIndex !== i) {
                useEditorStore.getState().reorderPage(fromIndex, i)
              }
            }}
          >
            <button
              type="button"
              className={active === i ? 'thumbnail active' : 'thumbnail'}
              aria-label={`Go to page ${i + 1}`}
              aria-current={active === i ? 'page' : undefined}
              onClick={() => {
                onSelect(i)
                onMobileDismiss?.()
              }}
            >
              <div className="thumbnail-paper">
                {pdf && <Thumbnail pdf={pdf} page={page} enabled={thumbnailsEnabled} />}
              </div>
              <span className="thumbnail-page-number">Page {i + 1}</span>
            </button>

            <div className="thumbnail-actions" role="group" aria-label={`Page ${i + 1} actions`}>
              <button
                type="button"
                className="thumbnail-action-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  useEditorStore.getState().rotatePage(i, 90)
                }}
                aria-label={`Rotate page ${i + 1} 90 degrees`}
                title={`Rotate page ${i + 1}`}
              >
                <RotateCw size={15} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="thumbnail-action-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  useEditorStore.getState().duplicatePage(i, { ...page, id: crypto.randomUUID() })
                }}
                aria-label={`Duplicate page ${i + 1}`}
                title={`Duplicate page ${i + 1}`}
              >
                <Copy size={15} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="thumbnail-action-btn thumbnail-action-delete"
                disabled={!canDeletePages}
                onClick={(e) => {
                  e.stopPropagation()
                  handleDelete(i)
                }}
                aria-label={`Delete page ${i + 1}`}
                title={canDeletePages ? `Delete page ${i + 1}` : 'Cannot delete the only page'}
              >
                <Trash2 size={15} aria-hidden="true" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </aside>
  )
}
