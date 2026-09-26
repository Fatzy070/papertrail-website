import { useEffect, useRef } from 'react'
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
    let sourcePageIndex = page.kind === 'imported' ? page.sourcePageIndex : (page as any).sourcePageIndex

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
}: {
  pdf: PDFDocumentProxy | null
  pages: EditorPage[]
  active: number
  onSelect: (index: number) => void
  onImportFromFile: (index: number) => void
}) {
  return (
    <aside className="page-sidebar">
      <div className="panel-heading">
        Pages <span className="count-badge">{pages.length}</span>
      </div>
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
              onClick={() => onSelect(i)}
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
            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-10 group/dropdown">
              <button 
                className="bg-blue-600 text-white rounded-full px-2 py-1 shadow-lg hover:bg-blue-700 text-xs whitespace-nowrap flex items-center gap-1"
                title="Add pages"
              >
                + Add pages <span className="text-[10px]">▾</span>
              </button>
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 hidden group-hover/dropdown:block bg-white border border-gray-200 rounded shadow-lg min-w-max py-1">
                <button
                  className="w-full text-left px-3 py-1 text-sm text-gray-700 hover:bg-gray-100 whitespace-nowrap"
                  onClick={(e) => {
                    e.stopPropagation()
                    useEditorStore.getState().addPage(i, {
                      id: crypto.randomUUID(),
                      kind: 'blank',
                      width: page.width,
                      height: page.height,
                      rotation: 0
                    })
                  }}
                >
                  Blank page
                </button>
                <button
                  className="w-full text-left px-3 py-1 text-sm text-gray-700 hover:bg-gray-100 whitespace-nowrap"
                  onClick={(e) => {
                    e.stopPropagation()
                    onImportFromFile(i)
                  }}
                >
                  From file
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </aside>
  )
}
