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
    { index: element.pageIndex, width: 0, height: 0, rotation: 0 },
    zoom,
  )
  const update = useEditorStore((s) => s.updateElement)
  const selected = useEditorStore((s) => s.selectedElementId === element.id)
  const start = useRef<{
    x: number
    y: number
    left: number
    top: number
  } | null>(null)
  function drag(event: PointerEvent<HTMLDivElement>) {
    onSelect(element.id)
    start.current = {
      x: event.clientX,
      y: event.clientY,
      left: element.x,
      top: element.y,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  function finish(event: PointerEvent<HTMLDivElement>) {
    if (!start.current) return
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
      }}
      onPointerDown={drag}
      onPointerUp={finish}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onSelect(element.id)
      }}
    >
      {selected ? (
        <input
          aria-label="Selected PDF text"
          value={element.text}
          onChange={(e) => update(element.id, { text: e.target.value })}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            fontSize: element.fontSize * zoom,
            color: element.color,
            lineHeight: 1,
            width: '100%',
            background: '#fff',
            border: 0,
            outline: 0,
            padding: 0,
          }}
        />
      ) : (
        <span
          style={{
            display: 'block',
            whiteSpace: 'nowrap',
            fontSize: element.fontSize * zoom,
            color:
              element.edited || element.source === 'user'
                ? element.color
                : 'transparent',
            background: element.edited ? 'white' : 'transparent',
            lineHeight: 1,
          }}
        >
          {element.text}
        </span>
      )}
    </div>
  )
}
