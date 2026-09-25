import { useRef, type PointerEvent } from 'react'
import type { ImageElement } from '../../types/editor'
import { useEditorStore } from '../../store/editor-store'

export function ImageOverlay({
  element,
  zoom,
  onSelect,
}: {
  element: ImageElement
  zoom: number
  onSelect: (id: string) => void
}) {
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

  function startResize(event: PointerEvent<HTMLDivElement>, handle: string) {
    if (element.locked) return
    event.stopPropagation()
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

  function doResize(event: PointerEvent<HTMLDivElement>) {
    if (!resizeStart.current || element.locked) return
    event.stopPropagation()
    const rs = resizeStart.current
    const dx = (event.clientX - rs.x) / zoom
    const dy = (event.clientY - rs.y) / zoom
    
    const isRight = rs.handle.includes('right')
    const isLeft = rs.handle.includes('left')
    const isBottom = rs.handle.includes('bottom')
    const isTop = rs.handle.includes('top')

    let delta = 0
    if (isRight && isBottom) {
      delta = Math.abs(dx) > Math.abs(dy) ? dx : dy * rs.aspectRatio
    } else if (isRight && isTop) {
      delta = Math.abs(dx) > Math.abs(dy) ? dx : -dy * rs.aspectRatio
    } else if (isLeft && isBottom) {
      delta = Math.abs(dx) > Math.abs(dy) ? -dx : dy * rs.aspectRatio
    } else if (isLeft && isTop) {
      delta = Math.abs(dx) > Math.abs(dy) ? -dx : -dy * rs.aspectRatio
    }

    const newWidth = Math.max(10, rs.width + delta)
    const newHeight = newWidth / rs.aspectRatio

    let newLeft = rs.left
    let newTop = rs.top
    if (isLeft) newLeft = rs.left + (rs.width - newWidth)
    if (isTop) newTop = rs.top + (rs.height - newHeight)

    const target = event.currentTarget.parentElement as HTMLElement
    if (target) {
      target.style.width = `${newWidth * zoom}px`
      target.style.height = `${newHeight * zoom}px`
      target.style.left = `${newLeft * zoom}px`
      target.style.top = `${newTop * zoom}px`
    }
  }

  function finishResize(event: PointerEvent<HTMLDivElement>) {
    if (!resizeStart.current || element.locked) return
    event.stopPropagation()
    const rs = resizeStart.current
    const dx = (event.clientX - rs.x) / zoom
    const dy = (event.clientY - rs.y) / zoom
    
    const isRight = rs.handle.includes('right')
    const isLeft = rs.handle.includes('left')
    const isBottom = rs.handle.includes('bottom')
    const isTop = rs.handle.includes('top')

    let delta = 0
    if (isRight && isBottom) {
      delta = Math.abs(dx) > Math.abs(dy) ? dx : dy * rs.aspectRatio
    } else if (isRight && isTop) {
      delta = Math.abs(dx) > Math.abs(dy) ? dx : -dy * rs.aspectRatio
    } else if (isLeft && isBottom) {
      delta = Math.abs(dx) > Math.abs(dy) ? -dx : dy * rs.aspectRatio
    } else if (isLeft && isTop) {
      delta = Math.abs(dx) > Math.abs(dy) ? -dx : -dy * rs.aspectRatio
    }

    const newWidth = Math.max(10, rs.width + delta)
    const newHeight = newWidth / rs.aspectRatio

    let newLeft = rs.left
    let newTop = rs.top
    if (isLeft) newLeft = rs.left + (rs.width - newWidth)
    if (isTop) newTop = rs.top + (rs.height - newHeight)

    update(element.id, {
      x: newLeft,
      y: newTop,
      width: newWidth,
      height: newHeight
    })
    resizeStart.current = null
    event.currentTarget.releasePointerCapture(event.pointerId)
  }
  
  const width = element.width * zoom
  const height = element.height * zoom
  
  return (
    <div
      data-text-element // reusing this so click outside logic ignores it
      tabIndex={0}
      role="button"
      className={`text-overlay ${selected ? 'selected' : ''}`}
      style={{
        left: element.x * zoom,
        top: element.y * zoom,
        width,
        height,
        position: 'absolute',
        outline: selected ? '2px solid var(--primary)' : 'none',
        outlineOffset: '2px',
        cursor: element.locked ? 'default' : selected ? 'move' : 'pointer',
        transform: `rotate(${element.rotation}deg)`,
        transformOrigin: 'center',
        pointerEvents: activeTool === 'edit-text' ? 'none' : 'auto',
      }}
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
      <img 
        src={element.src} 
        alt=""
        draggable={false}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          display: 'block',
          pointerEvents: 'none',
        }}
      />
      {selected && !element.locked && (
        <>
          <div 
            style={{ position: 'absolute', top: -4, left: -4, width: 10, height: 10, background: 'var(--primary)', border: '1px solid white', borderRadius: '50%', cursor: 'nwse-resize' }}
            onPointerDown={(e) => startResize(e, 'top-left')}
            onPointerMove={doResize}
            onPointerUp={finishResize}
            onPointerCancel={finishResize}
          />
          <div 
            style={{ position: 'absolute', top: -4, right: -4, width: 10, height: 10, background: 'var(--primary)', border: '1px solid white', borderRadius: '50%', cursor: 'nesw-resize' }}
            onPointerDown={(e) => startResize(e, 'top-right')}
            onPointerMove={doResize}
            onPointerUp={finishResize}
            onPointerCancel={finishResize}
          />
          <div 
            style={{ position: 'absolute', bottom: -4, left: -4, width: 10, height: 10, background: 'var(--primary)', border: '1px solid white', borderRadius: '50%', cursor: 'nesw-resize' }}
            onPointerDown={(e) => startResize(e, 'bottom-left')}
            onPointerMove={doResize}
            onPointerUp={finishResize}
            onPointerCancel={finishResize}
          />
          <div 
            style={{ position: 'absolute', bottom: -4, right: -4, width: 10, height: 10, background: 'var(--primary)', border: '1px solid white', borderRadius: '50%', cursor: 'nwse-resize' }}
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
