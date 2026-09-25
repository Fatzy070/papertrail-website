import { useRef, type PointerEvent } from 'react'
import type { TextElement } from '../../types/editor'
import { pageRectToCss } from '../../engine/coordinate-transformer'
import { useEditorStore } from '../../store/editor-store'
export function TextOverlay({
  element,
  zoom,
  onSelect,
}: {
  element: TextElement
  zoom: number
  onSelect: (id: string) => void
}) {
  const rect = pageRectToCss(
    element,
    { id: element.pageId, width: 0, height: 0, rotation: 0 } as any,
    zoom,
  )
  const update = useEditorStore((s) => s.updateElement)
  const selected = useEditorStore((s) => s.selectedElementId === element.id)
  const activeTool = useEditorStore((s) => s.activeTool)
  const setActiveTool = useEditorStore((s) => s.setActiveTool)
  
  const isPdfText = element.source === 'pdf'
  const isEditable = activeTool === 'edit-text'
  const isPointer = activeTool === 'pointer'

  const start = useRef<{
    x: number
    y: number
    left: number
    top: number
  } | null>(null)
  function drag(event: PointerEvent<HTMLDivElement>) {
    if (element.locked) return
    onSelect(element.id)
    
    // Extracted PDF text is never draggable. Added text is only draggable in pointer mode.
    if (isPdfText || !isPointer) return

    start.current = {
      x: event.clientX,
      y: event.clientY,
      left: element.x,
      top: element.y,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  function finish(event: PointerEvent<HTMLDivElement>) {
    if (!start.current || element.locked) return
    const dx = (event.clientX - start.current.x) / zoom
    const dy = (event.clientY - start.current.y) / zoom
    if (Math.abs(dx) + Math.abs(dy) > 2)
      update(element.id, {
        x: start.current.left + dx,
        y: start.current.top + dy,
      })
    start.current = null
  }
  return (
    <div
      data-text-element
      tabIndex={0}
      role="button"
      aria-label={`Edit text: ${element.text}`}
      className={`text-overlay ${selected ? 'selected' : ''}`}
      style={{
        left: rect.left,
        top: rect.top,
        width: Math.max(rect.width, 24),
        minHeight: rect.height,
        transform: `rotate(${rect.rotation}deg)`,
        transformOrigin: 'top left',
        pointerEvents: isPointer && isPdfText ? 'none' : 'auto',
        userSelect: isPointer && isPdfText ? 'none' : 'text',
      }}
      onDoubleClick={() => {
        if (!isPdfText && isPointer) {
          setActiveTool('edit-text')
        }
      }}
      onPointerDown={drag}
      onPointerUp={finish}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onSelect(element.id)
      }}
    >
      {selected && isEditable ? (
        <textarea
          aria-label="Selected PDF text"
          value={element.text}
          onChange={(e) => update(element.id, { text: e.target.value })}
          onPointerDown={(e) => e.stopPropagation()}
          disabled={element.locked}
          style={{
            fontSize: element.fontSize * zoom,
            fontFamily: element.fontFamily,
            fontWeight: element.bold ? 'bold' : 'normal',
            fontStyle: element.italic ? 'italic' : 'normal',
            textAlign: element.textAlign || 'left',
            color: element.link && (element.color === '#1f2937' || element.color === '#000000') ? '#2563eb' : element.color,
            textDecoration: element.link ? 'underline' : 'none',
            lineHeight: element.lineHeight || 1.2,
            width: '100%',
            height: '100%',
            background: 'rgba(255, 255, 255, 0.9)',
            border: 0,
            outline: 0,
            padding: 0,
            resize: 'none',
            overflow: 'hidden',
          }}
        />
      ) : (
        <span
          style={{
            display: 'block',
            whiteSpace: 'pre-wrap',
            fontSize: element.fontSize * zoom,
            fontFamily: element.fontFamily,
            fontWeight: element.bold ? 'bold' : 'normal',
            fontStyle: element.italic ? 'italic' : 'normal',
            textAlign: element.textAlign || 'left',
            color:
              element.edited || element.source === 'user' || element.link
                ? (element.link && (element.color === '#1f2937' || element.color === '#000000') ? '#2563eb' : element.color)
                : 'transparent',
            background: element.edited ? 'rgba(255, 255, 255, 0.9)' : 'transparent',
            lineHeight: element.lineHeight || 1.2,
            textDecoration: element.link ? 'underline' : 'none',
          }}
        >
          {element.text}
        </span>
      )}
    </div>
  )
}
