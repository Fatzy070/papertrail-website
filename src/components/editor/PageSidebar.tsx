import { useEffect, useRef } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { PdfPageInfo } from '../../types/editor'


function Thumbnail({
  pdf,
  page,
}: {
  pdf: PDFDocumentProxy
  page: PdfPageInfo
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    let cancelled = false
    let task:
      | ReturnType<Awaited<ReturnType<PDFDocumentProxy['getPage']>>['render']>
      | undefined
    void pdf
      .getPage(page.index + 1)
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
}: {
  pdf: PDFDocumentProxy | null
  pages: PdfPageInfo[]
  active: number
  onSelect: (index: number) => void
}) {
  return (
    <aside className="page-sidebar">
      <div className="panel-heading">
        Pages <span className="count-badge">{pages.length}</span>
      </div>
      <div className="thumbnail-list">
        {pages.map((page) => (
          <button
            className={active === page.index ? 'thumbnail active' : 'thumbnail'}
            key={page.index}
            aria-label={`Go to page ${page.index + 1}`}
            aria-current={active === page.index ? 'page' : undefined}
            onClick={() => onSelect(page.index)}
          >
            <div className="thumbnail-paper">
              {pdf && <Thumbnail pdf={pdf} page={page} />}
            </div>
            <span>{page.index + 1}</span>
          </button>
        ))}
      </div>
    </aside>
  )
}
