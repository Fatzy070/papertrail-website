import { useEffect, useRef, useState, type MouseEvent } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { PdfPageInfo } from '../../types/editor'
import { renderPage } from '../../engine/pdf-renderer'
import { TextOverlay } from './TextOverlay'
import { useEditorStore } from '../../store/editor-store'

export function PdfPage({  pdf,  page, }: { pdf: PDFDocumentProxy , page: PdfPageInfo }) {

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const zoom = useEditorStore((state) => state.zoom)
  const allElements = useEditorStore((state) => state.textElements)
  const elements = allElements.filter(
    (element) => element.pageIndex === page.index,
  )
  const selectElement = useEditorStore((state) => state.selectElement)
  const addTextElement = useEditorStore((state) => state.addTextElement)
  const activeTool = useEditorStore((state) => state.activeTool)
  const setActiveTool = useEditorStore((state) => state.setActiveTool)
  const [renderError, setRenderError] = useState(false)

  
  useEffect(() => {
    const controller = new AbortController()
    if (canvasRef.current)
      void renderPage(
        pdf,
        page,
        canvasRef.current,
        zoom,
        controller.signal,
      ).catch(() => setRenderError(true))
    return () => controller.abort()
  }, [pdf, page, zoom])

  function addAt(event: MouseEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest('[data-text-element]')) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const id = crypto.randomUUID()
    addTextElement({
      id,
      pageIndex: page.index,
      source: 'user',
      originalText: '',
      text: 'New text',
      x: (event.clientX - bounds.left) / zoom,
      y: (event.clientY - bounds.top) / zoom,
      width: 120,
      height: 20,
      fontSize: 14,
      fontFamily: 'Helvetica',
      color: '#1f2937',
      rotation: 0,
      edited: true,
    })
    selectElement(id)
    setActiveTool('select')
  }
  return (
    <div
      className="pdf-paper"
      style={{
        width: page.width * zoom,
        height: page.height * zoom,
        cursor: activeTool === 'text' ? 'text' : undefined,
      }}
      onDoubleClick={addAt}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest('[data-text-element]')) return
        if (activeTool === 'text') addAt(event)
        else selectElement(null)
      }}
    >
      <canvas ref={canvasRef} className="absolute inset-0" />
      <div className="absolute inset-0">
        {elements
          .filter((element) => element.edited && element.source === 'pdf')
          .map((element) => {
            const bounds = element.originalBounds ?? element
            return (
              <div
                key={element.id}
                style={{
                  position: 'absolute',
                  pointerEvents: 'none',
                  background: 'white',
                  left: bounds.x * zoom,
                  top: bounds.y * zoom,
                  width: bounds.width * zoom,
                  height: (bounds.height + 2) * zoom,
                }}
              />
            )
          })}
        {elements.map((element) => (
          <TextOverlay
            key={element.id}
            element={element}
            zoom={zoom}
            onSelect={selectElement}
          />
        ))}
      </div>
      {renderError && (
        <p className="error-message relative" role="alert">
          This page could not be rendered. Reopen the document to try again.
        </p>
      )}
    </div>
  )
}
