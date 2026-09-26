import { useRef, type PointerEvent } from 'react'
import { useEditorStore } from '../../store/editor-store'

interface ResizableWrapperProps {
  element: any // ImageElement | SignatureElement
  zoom: number
  onSelect: (id: string) => void
  preserveAspectRatio?: boolean
  children: React.ReactNode
}

export function ResizableWrapper({
  element,
  zoom,
  onSelect,
  preserveAspectRatio = false,
  children
}: ResizableWrapperProps) {
  const update = useEditorStore((s) => s.updateElement)
  const selected = useEditorStore((s) => s.selectedElementId === element.id)
  const activeTool = useEditorStore((s) => s.activeTool)

  const start = useRef<{
    x: number
    y: number
    left: number
    top: number
  } | null>(null)

  const resizeStart = useRef<{
    x: number
    y: number
    left: number
    top: number
    width: number
    height: number
    handle: string
    aspectRatio: number
  } | null>(null)

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

  function dragMove(e: PointerEvent<HTMLDivElement>) {
    if (!start.current || element.locked) return
    const dx = (e.clientX - start.current.x) / zoom
    const dy = (e.clientY - start.current.y) / zoom
    e.currentTarget.style.left = `${(start.current.left + dx) * zoom}px`
    e.currentTarget.style.top = `${(start.current.top + dy) * zoom}px`
  }

  function finishDrag(event: PointerEvent<HTMLDivElement>) {
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
    event.currentTarget.releasePointerCapture(event.pointerId)
  }

  function startResize(event: PointerEvent<HTMLDivElement>, handle: string) {
    if (element.locked) return
    event.stopPropagation() // Prevent triggering drag
    onSelect(element.id)
    resizeStart.current = {
      x: event.clientX,
      y: event.clientY,
      left: element.x,
      top: element.y,
      width: element.width,
      height: element.height,
      handle,
      aspectRatio: element.width / element.height,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function calculateResize(event: PointerEvent<HTMLDivElement>): { newWidth: number, newHeight: number, newLeft: number, newTop: number } | null {
    if (!resizeStart.current) return null
    const rs = resizeStart.current
    const dx = (event.clientX - rs.x) / zoom
    const dy = (event.clientY - rs.y) / zoom

    const isRight = rs.handle.includes('right')
    const isLeft = rs.handle.includes('left')
    const isBottom = rs.handle.includes('bottom')
    const isTop = rs.handle.includes('top')
    const isCenterH = rs.handle.includes('center')
    const isMiddleV = rs.handle.includes('middle')

    let newWidth = rs.width
    let newHeight = rs.height
    let newLeft = rs.left
    let newTop = rs.top

    // Handle width
    if (isRight) {
      newWidth = Math.max(10, rs.width + dx)
    } else if (isLeft) {
      newWidth = Math.max(10, rs.width - dx)
      newLeft = rs.left + (rs.width - newWidth)
    }

    // Handle height
    if (isBottom) {
      newHeight = Math.max(10, rs.height + dy)
    } else if (isTop) {
      newHeight = Math.max(10, rs.height - dy)
      newTop = rs.top + (rs.height - newHeight)
    }

    // Handle aspect ratio for corner handles
    if (preserveAspectRatio && !isCenterH && !isMiddleV) {
      // which axis drove the resize more?
      // simple approach: use width to dictate height, but respect direction
      if (isRight || isLeft) {
        const expectedHeight = newWidth / rs.aspectRatio
        // Adjust top if we are resizing from top
        if (isTop) {
           newTop = rs.top + (rs.height - expectedHeight)
        }
        newHeight = expectedHeight
      }
    }

    return { newWidth, newHeight, newLeft, newTop }
  }

  function doResize(event: PointerEvent<HTMLDivElement>) {
    if (!resizeStart.current || element.locked) return
    event.stopPropagation()
    const result = calculateResize(event)
    if (!result) return

    // Find the wrapper element
    // The event target is the handle. Its parent is the fragment or wrapper.
    const target = event.currentTarget.parentElement as HTMLElement
    if (target) {
      target.style.width = `${result.newWidth * zoom}px`
      target.style.height = `${result.newHeight * zoom}px`
      target.style.left = `${result.newLeft * zoom}px`
      target.style.top = `${result.newTop * zoom}px`
    }
  }

  function finishResize(event: PointerEvent<HTMLDivElement>) {
    if (!resizeStart.current || element.locked) return
    event.stopPropagation()
    const result = calculateResize(event)
    if (result) {
      update(element.id, {
        x: result.newLeft,
        y: result.newTop,
        width: result.newWidth,
        height: result.newHeight
      })
    }
    resizeStart.current = null
    event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const width = element.width * zoom
  const height = element.height * zoom

  const handleStyle = {
    position: 'absolute' as const,
    width: 10,
    height: 10,
    background: 'var(--primary, #2563eb)',
    border: '1px solid white',
    borderRadius: '50%',
    zIndex: 20
  }

  return (
    <div
      data-text-element // reusing so click outside logic ignores it
      tabIndex={0}
      role="button"
      className={`text-overlay ${selected ? 'selected' : ''}`}
      style={{
        left: element.x * zoom,
        top: element.y * zoom,
        width,
        height,
        position: 'absolute',
        outline: selected ? '1px solid var(--primary, #2563eb)' : 'none',
        cursor: element.locked ? 'default' : selected ? 'move' : 'pointer',
        transform: `rotate(${element.rotation}deg)`,
        transformOrigin: 'center',
        pointerEvents: activeTool === 'pointer' ? 'auto' : 'none',
      }}
      onPointerDown={drag}
      onPointerMove={dragMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
    >
      {children}
      
      {selected && !element.locked && (
        <>
          {/* Top-Left */}
          <div 
            style={{ ...handleStyle, top: -5, left: -5, cursor: 'nwse-resize' }}
            onPointerDown={(e) => startResize(e, 'top-left')}
            onPointerMove={doResize}
            onPointerUp={finishResize}
            onPointerCancel={finishResize}
          />
          {/* Top-Center */}
          <div 
            style={{ ...handleStyle, top: -5, left: 'calc(50% - 5px)', cursor: 'ns-resize' }}
            onPointerDown={(e) => startResize(e, 'top-center')}
            onPointerMove={doResize}
            onPointerUp={finishResize}
            onPointerCancel={finishResize}
          />
          {/* Top-Right */}
          <div 
            style={{ ...handleStyle, top: -5, right: -5, cursor: 'nesw-resize' }}
            onPointerDown={(e) => startResize(e, 'top-right')}
            onPointerMove={doResize}
            onPointerUp={finishResize}
            onPointerCancel={finishResize}
          />
          {/* Middle-Left */}
          <div 
            style={{ ...handleStyle, top: 'calc(50% - 5px)', left: -5, cursor: 'ew-resize' }}
            onPointerDown={(e) => startResize(e, 'middle-left')}
            onPointerMove={doResize}
            onPointerUp={finishResize}
            onPointerCancel={finishResize}
          />
          {/* Middle-Right */}
          <div 
            style={{ ...handleStyle, top: 'calc(50% - 5px)', right: -5, cursor: 'ew-resize' }}
            onPointerDown={(e) => startResize(e, 'middle-right')}
            onPointerMove={doResize}
            onPointerUp={finishResize}
            onPointerCancel={finishResize}
          />
          {/* Bottom-Left */}
          <div 
            style={{ ...handleStyle, bottom: -5, left: -5, cursor: 'nesw-resize' }}
            onPointerDown={(e) => startResize(e, 'bottom-left')}
            onPointerMove={doResize}
            onPointerUp={finishResize}
            onPointerCancel={finishResize}
          />
          {/* Bottom-Center */}
          <div 
            style={{ ...handleStyle, bottom: -5, left: 'calc(50% - 5px)', cursor: 'ns-resize' }}
            onPointerDown={(e) => startResize(e, 'bottom-center')}
            onPointerMove={doResize}
            onPointerUp={finishResize}
            onPointerCancel={finishResize}
          />
          {/* Bottom-Right */}
          <div 
            style={{ ...handleStyle, bottom: -5, right: -5, cursor: 'nwse-resize' }}
            onPointerDown={(e) => startResize(e, 'bottom-right')}
            onPointerMove={doResize}
            onPointerUp={finishResize}
            onPointerCancel={finishResize}
          />
        </>
      )}
    </div>
  )
}
