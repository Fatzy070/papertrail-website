import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { EditorPage } from '../../types/editor'
import { renderPage } from '../../engine/pdf-renderer'
import { TextOverlay } from './TextOverlay'
import { ImageOverlay } from './ImageOverlay'
import { DrawingOverlay } from './DrawingOverlay'
import { SignatureModal } from './SignatureModal'
import { NoteOverlay } from './NoteOverlay'
import { useEditorStore } from '../../store/editor-store'
import { getStroke } from 'perfect-freehand'

function getSvgPathFromStroke(stroke: number[][]) {
  if (!stroke.length) return ''
  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length]
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2)
      return acc
    },
    ['M', ...stroke[0], 'Q']
  )
  d.push('Z')
  return d.join(' ')
}

export function PdfPage({  pdf,  page, }: { pdf: PDFDocumentProxy , page: EditorPage }) {

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const zoom = useEditorStore((state) => state.zoom)
  const allElements = useEditorStore((state) => state.elements)
  const elements = allElements.filter(
    (element) => element.pageId === page.id,
  )
  const selectElement = useEditorStore((state) => state.selectElement)
  const addElement = useEditorStore((state) => state.addElement)
  const activeTool = useEditorStore((state) => state.activeTool)
  const setActiveTool = useEditorStore((state) => state.setActiveTool)
  const [renderError, setRenderError] = useState(false)

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentStroke, setCurrentStroke] = useState<{ x: number; y: number; pressure?: number }[]>([])
  
  // Signature state
  const [showSignatureModal, setShowSignatureModal] = useState<{x: number, y: number} | null>(null)

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



  function getPagePoint(e: MouseEvent | PointerEvent) {
    const bounds = e.currentTarget.getBoundingClientRect()
    return {
      x: (e.clientX - bounds.left) / zoom,
      y: (e.clientY - bounds.top) / zoom,
      pressure: 'pressure' in e ? (e as any).pressure : 0.5
    }
  }

  function handlePointerDown(e: PointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest('[data-text-element]')) return
    if (activeTool !== 'draw') return
    
    e.currentTarget.setPointerCapture(e.pointerId)
    setIsDrawing(true)
    setCurrentStroke([getPagePoint(e)])
  }

  function handlePointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!isDrawing) return
    setCurrentStroke([...currentStroke, getPagePoint(e)])
  }

  function handlePointerUp(e: PointerEvent<HTMLDivElement>) {
    if (!isDrawing) return
    setIsDrawing(false)
    e.currentTarget.releasePointerCapture(e.pointerId)

    if (currentStroke.length > 3) {
      // Calculate bounds
      const xs = currentStroke.map(p => p.x)
      const ys = currentStroke.map(p => p.y)
      const minX = Math.min(...xs) - 10
      const maxX = Math.max(...xs) + 10
      const minY = Math.min(...ys) - 10
      const maxY = Math.max(...ys) + 10
      
      // Normalize points to local drawing coordinates
      const localPoints = currentStroke.map(p => ({
        x: p.x - minX,
        y: p.y - minY,
        pressure: p.pressure
      }))

      const drawSettings = useEditorStore.getState().drawSettings
      addElement({
        type: 'drawing',
        id: crypto.randomUUID(),
        pageId: page.id,
        points: localPoints,
        color: drawSettings.color,
        strokeWidth: drawSettings.strokeWidth,
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY
      })
    }
    setCurrentStroke([])
  }

  function addAt(event: MouseEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest('[data-text-element]')) return
    const pt = getPagePoint(event)

    if (activeTool === 'sign') {
      setShowSignatureModal({ x: pt.x, y: pt.y })
      return
    }

    if (activeTool === 'note') {
      const id = crypto.randomUUID()
      addElement({
        type: 'note',
        id,
        pageId: page.id,
        source: 'user',
        text: '',
        color: '#fef08a',
        x: pt.x,
        y: pt.y,
        width: 150,
        height: 150,
      })
      selectElement(id)
      setActiveTool('pointer')
      return
    }

    const id = crypto.randomUUID()
    addElement({
          type: 'text',
      id,
      pageId: page.id,
      source: 'user',
      originalText: '',
      text: 'New text',
      x: pt.x,
      y: pt.y,
      width: 120,
      height: 20,
      fontSize: 14,
      fontFamily: 'Helvetica',
      color: '#1f2937',
      rotation: 0,
      edited: true,
    })
    selectElement(id)
    setActiveTool('edit-text')
  }

  // Render current drawing stroke
  const currentSvgPath = currentStroke.length > 0 ? getSvgPathFromStroke(getStroke(currentStroke, { size: 4, thinning: 0.5, smoothing: 0.5, streamline: 0.5 })) : ''

  return (
    <div
      className="pdf-paper"
      style={{
        width: page.width * zoom,
        height: page.height * zoom,
        cursor: activeTool === 'text' ? 'text' : activeTool === 'edit-text' ? 'text' : activeTool === 'draw' ? 'crosshair' : activeTool === 'note' ? 'crosshair' : undefined,
        touchAction: activeTool === 'draw' ? 'none' : 'auto' // Prevent scrolling while drawing
      }}
      onDoubleClick={activeTool === 'text' || activeTool === 'note' ? undefined : addAt}
      onClick={(event) => {
        if (activeTool === 'draw') return // Click handled by pointer events
        if ((event.target as HTMLElement).closest('[data-text-element]')) return
        if (activeTool === 'text' || activeTool === 'note' || activeTool === 'sign') addAt(event)
        else selectElement(null)
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <canvas ref={canvasRef} className="absolute inset-0" />
      <div className="absolute inset-0">
        {elements
          .filter((element) => element.type === 'text' && (element as any).edited && (element as any).source === 'pdf')
          .map((element: any) => {
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
        {elements
          .filter((element) => element.type === 'image' || element.type === 'signature')
          .map((element) => (
          <ImageOverlay
            key={element.id}
            element={element as any}
            zoom={zoom}
            onSelect={selectElement}
          />
        ))}
        {elements
          .filter((element) => element.type === 'drawing')
          .map((element) => (
          <DrawingOverlay
            key={element.id}
            element={element as any}
            zoom={zoom}
            onSelect={selectElement}
          />
        ))}
        {elements
          .filter((element) => element.type === 'text')
          .map((element) => (
          <TextOverlay
            key={element.id}
            element={element as any}
            zoom={zoom}
            onSelect={selectElement}
          />
        ))}
        {elements
          .filter((element) => element.type === 'note')
          .map((element) => (
          <NoteOverlay
            key={element.id}
            element={element as any}
            zoom={zoom}
            onSelect={selectElement}
          />
        ))}
      </div>
      
      {/* Current Drawing Stroke Overlay */}
      {isDrawing && currentStroke.length > 0 && (
        <svg className="absolute inset-0 pointer-events-none" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
           <path d={currentSvgPath} fill="#ff0000" transform={`scale(${zoom})`} />
        </svg>
      )}

      {renderError && (
        <p className="error-message relative" role="alert">
          This page could not be rendered. Reopen the document to try again.
        </p>
      )}

      {showSignatureModal && (
        <SignatureModal
          onClose={() => setShowSignatureModal(null)}
          onSave={(src) => {
            const id = crypto.randomUUID()
            addElement({
              type: 'signature',
              id,
              pageId: page.id,
              src,
              x: showSignatureModal.x,
              y: showSignatureModal.y,
              width: 150,
              height: 75,
              rotation: 0
            })
            setShowSignatureModal(null)
            selectElement(id)
            setActiveTool('pointer')
          }}
        />
      )}
    </div>
  )
}
