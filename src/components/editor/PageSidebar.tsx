import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { EditorPage } from '../../types/editor'
import { useEditorStore } from '../../store/editor-store'
import { pdfCache } from '../../engine/pdf-cache'


function Thumbnail({
  pdf,
  page,
}: {
  pdf: PDFDocumentProxy
  page: EditorPage
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (page.kind === 'blank') {
      if (ref.current) {
        const scale = 112 / page.width
        ref.current.width = page.width * scale
        ref.current.height = page.height * scale
        const ctx = ref.current.getContext('2d')
        if (ctx) {
          ctx.fillStyle = 'white'
          ctx.fillRect(0, 0, ref.current.width, ref.current.height)
        }
      }
      return
    }

    let cancelled = false
    let task:
      | ReturnType<Awaited<ReturnType<PDFDocumentProxy['getPage']>>['render']>
      | undefined
    
    // Resolve the proxy to use
    let sourceProxy = pdf
    const sourcePageIndex = page.kind === 'imported'
      ? page.sourcePageIndex
      : page.kind === 'source' ? page.sourcePageIndex : 0

    // Check if imported and from cache
    if (page.kind === 'imported') {
      const cached = pdfCache.get(page.sourceDocumentId)
      if (cached) {
        sourceProxy = cached.proxy
      }
    }

    void sourceProxy
      .getPage(sourcePageIndex + 1)
      .then((value) => {
        if (cancelled || !ref.current) return
        const viewport = value.getViewport({ scale: 112 / page.width })
        ref.current.width = viewport.width
        ref.current.height = viewport.height
        task = value.render({ canvas: ref.current, viewport })
        return task.promise
      })
      .catch(() => {})
    return () => {
      cancelled = true
      task?.cancel()
    }
  }, [pdf, page])
  return <canvas ref={ref} />
}

export function PageSidebar({
  pdf,
  pages,
  active,
  onSelect,
  onImportFromFile,
  mobileOpen = false,
  onMobileDismiss,
}: {
  pdf: PDFDocumentProxy | null
  pages: EditorPage[]
  active: number
  onSelect: (index: number) => void
  onImportFromFile: (index: number) => void
  mobileOpen?: boolean
  onMobileDismiss?: () => void
}) {
  const [addPagesOpen, setAddPagesOpen] = useState(false)
  const addPagesRef = useRef<HTMLDivElement>(null)
  // Insertion index for the top-level Add Pages button: append after last page
  const insertIndex = Math.max(0, pages.length - 1)
  const lastPage = pages[insertIndex]

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

  return (
    <aside className={mobileOpen ? 'page-sidebar mobile-panel-open' : 'page-sidebar'}>
      {/* ── Sticky header with page count + Add Pages ── */}
      <div className="panel-heading" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', position: 'sticky', top: 0, zIndex: 10, background: 'var(--sidebar-bg, #f8f9fa)' }}>
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
            className="thumbnail-wrapper group relative"
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
              className={active === i ? 'thumbnail active' : 'thumbnail'}
              aria-label={`Go to page ${i + 1}`}
              aria-current={active === i ? 'page' : undefined}
              onClick={() => {
                onSelect(i)
                onMobileDismiss?.()
              }}
            >
              <div className="thumbnail-paper">
                {pdf && <Thumbnail pdf={pdf} page={page} />}
              </div>
              <span>{i + 1}</span>
            </button>
            <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                className="p-1 bg-white border border-gray-200 rounded shadow hover:bg-gray-50"
                onClick={(e) => { e.stopPropagation(); useEditorStore.getState().rotatePage(i, 90) }}
                title="Rotate 90°"
              >
                ⟳
              </button>
              <button 
                className="p-1 bg-white border border-gray-200 rounded shadow hover:bg-gray-50"
                onClick={(e) => { e.stopPropagation(); useEditorStore.getState().duplicatePage(i, { ...page, id: crypto.randomUUID() }) }}
                title="Duplicate"
              >
                ⎘
              </button>
              {pages.length > 1 && (
                <button 
                  className="p-1 bg-white border border-gray-200 rounded shadow hover:bg-red-50 text-red-600"
                  onClick={(e) => { e.stopPropagation(); useEditorStore.getState().deletePage(i) }}
                  title="Delete"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </aside>
  )
}
