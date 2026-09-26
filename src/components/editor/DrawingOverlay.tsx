import { useRef, type PointerEvent } from 'react'
import { getStroke } from 'perfect-freehand'
import type { DrawingElement } from '../../types/editor'
import { useEditorStore } from '../../store/editor-store'

export function DrawingOverlay({
  element,
  zoom,
  onSelect,
}: {
  element: DrawingElement
  zoom: number
  onSelect: (id: string) => void
}) {
  const stroke = getStroke(element.points, {
    size: element.strokeWidth,
    thinning: 0.5,
    smoothing: 0.5,
    streamline: 0.5,
  })

  const update = useEditorStore((s) => s.updateElement)
  const selected = useEditorStore((s) => s.selectedElementId === element.id)
  const activeTool = useEditorStore((s) => s.activeTool)
  const start = useRef<{ x: number; y: number; left: number; top: number } | null>(null)

  function drag(event: PointerEvent<HTMLDivElement>) {
    if (element.locked) return
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
    if (!start.current || element.locked) return
    const dx = (event.clientX - start.current.x) / zoom
    const dy = (event.clientY - start.current.y) / zoom
    if (Math.abs(dx) + Math.abs(dy) > 2) {
      update(element.id, {
        x: start.current.left + dx,
        y: start.current.top + dy,
      })
    }
    start.current = null
  }

  // To SVG path data
  const pathData = stroke.length
    ? `M ${stroke[0][0]} ${stroke[0][1]} Q ` +
      stroke
        .slice(1)
        .map((p, i, arr) => {
          const next = arr[i + 1]
          if (next) {
            const midX = (p[0] + next[0]) / 2
            const midY = (p[1] + next[1]) / 2
            return `${p[0]} ${p[1]} ${midX} ${midY}`
          }
          return `${p[0]} ${p[1]} ${p[0]} ${p[1]}`
        })
        .join(' ')
    : ''

  return (
    <div
      data-text-element
      style={{
        position: 'absolute',
        left: element.x * zoom,
        top: element.y * zoom,
        width: element.width * zoom,
        height: element.height * zoom,
        pointerEvents: 'none',
      }}
      className={`group ${selected ? 'selected' : ''}`}
      onPointerDown={drag}
      onPointerUp={finish}
      onPointerCancel={finish}
      onPointerMove={(e) => {
        if (!start.current || element.locked) return
        const dx = (e.clientX - start.current.x) / zoom
        const dy = (e.clientY - start.current.y) / zoom
        e.currentTarget.style.left = `${(start.current.left + dx) * zoom}px`
        e.currentTarget.style.top = `${(start.current.top + dy) * zoom}px`
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${element.width} ${element.height}`}
        style={{
          overflow: 'visible',
          display: 'block',
          cursor: element.locked ? 'not-allowed' : 'pointer'
        }}
      >
        <path 
          d={pathData} 
          fill={element.color} 
          stroke="transparent" 
          strokeWidth={15} 
          style={{ pointerEvents: element.locked || activeTool !== 'pointer' ? 'none' : 'all' }}
        />
      </svg>
      {/* Selected Indicator */}
      <div
        className="absolute inset-0 border-[1.5px] border-transparent group-[.selected]:border-blue-500/70 pointer-events-none"
        style={{ transition: 'border-color 0.1s' }}
      />
    </div>
  )
}
