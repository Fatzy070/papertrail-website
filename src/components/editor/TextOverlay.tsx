import { useRef, useState, useEffect, useCallback, type PointerEvent } from 'react'
import type { TextElement } from '../../types/editor'
import { pageRectToCss } from '../../engine/coordinate-transformer'
import { useEditorStore } from '../../store/editor-store'
import { measureTextElement, measureTextHeight } from '../../engine/text-measurement'
import { resolveFontId, getCssFontFamily } from '../../engine/font-registry'
import type { EditorPage } from '../../types/editor'

interface Props {
  element: TextElement
  zoom: number
  onSelect: (id: string) => void
}

export function TextOverlay({ element, zoom, onSelect }: Props) {
  const rect = pageRectToCss(
    element,
    { id: element.pageId, width: 0, height: 0, rotation: 0 } as unknown as EditorPage,
    zoom,
  )
  const update = useEditorStore((s) => s.updateElement)
  const remove = useEditorStore((s) => s.deleteSelected)
  const selected = useEditorStore((s) => s.selectedElementId === element.id)
  const activeTool = useEditorStore((s) => s.activeTool)
  const page = useEditorStore((s) => s.document?.pages.find((p) => p.id === element.pageId))

  const isPdfText = element.source === 'pdf'
  const isUserText = element.source === 'user'

  // For user-added text, we start in editing mode right away if it hasn't been edited yet
  const [isEditing, setIsEditing] = useState(() => isUserText && !element.edited)

  useEffect(() => {
    if (!selected) {
      setIsEditing(false)
    }
  }, [selected])

  // When user text is newly selected (and it was never edited), enter editing
  useEffect(() => {
    if (selected && isUserText && !element.edited && !isEditing) {
      setIsEditing(true)
    }
  }, [selected, isUserText, element.edited, isEditing])

  // Resolve font for preview
  const fontId = element.fontId ?? resolveFontId(element.fontFamily || 'Helvetica')
  const cssFontFamily = getCssFontFamily(fontId)

  // Interaction rules:
  //  - PDF text: interactive only in edit-text mode
  //  - User text: interactive in pointer mode (move/resize), or when selected (edit on dblclick)
  const allowInteraction = isPdfText
    ? activeTool === 'edit-text'
    : activeTool === 'pointer' || activeTool === 'text'

  // In edit-text mode, the textarea is active for pdf text
  // In pointer mode for user text, double-click activates textarea
  const isEditable = (isPdfText && activeTool === 'edit-text' && selected) ||
                     (isUserText && isEditing && selected)

  // ── Drag to move ─────────────────────────────────────────────────────────
  const start = useRef<{ x: number; y: number; left: number; top: number } | null>(null)

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    // Always stop propagation so PdfPage's click handler doesn't deselect us
    event.stopPropagation()

    if (element.locked) return
    onSelect(element.id)

    // Only drag for user text in pointer mode
    if (!isUserText || activeTool !== 'pointer') return

    start.current = {
      x: event.clientX,
      y: event.clientY,
      left: element.x,
      top: element.y,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    if (!start.current || element.locked) return
    const dx = (event.clientX - start.current.x) / zoom
    const dy = (event.clientY - start.current.y) / zoom
    if (Math.abs(dx) + Math.abs(dy) > 2) {
      update(element.id, { x: start.current.left + dx, y: start.current.top + dy })
    }
    start.current = null
  }

  // ── Auto-grow width for user text ────────────────────────────────────────
  const getMaxWidth = useCallback(() => {
    if (!page) return 500
    return Math.max(50, (page as { width: number }).width - element.x - 8)
  }, [page, element.x])

  function handleTextChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const newText = e.target.value
    const maxWidth = getMaxWidth()

    let newWidth = element.width
    let newHeight = element.height

    if (!element.manualWidth) {
      // Auto-grow: measure the widest line and expand until page boundary
      const measured = measureTextElement(
        newText,
        element.fontSize,
        element.fontFamily,
        element.bold,
        element.italic,
        element.fontId,
      )
      newWidth = Math.min(Math.max(newWidth, measured, 60), maxWidth)
    }

    // Height: always driven by content
    newHeight = measureTextHeight(
      newText,
      element.fontSize,
      element.fontFamily,
      element.bold,
      element.italic,
      element.lineHeight ?? 1.2,
      newWidth,
      element.fontId,
    )
    newHeight = Math.max(element.fontSize * (element.lineHeight ?? 1.2), newHeight)

    update(element.id, {
      text: newText,
      width: newWidth,
      height: newHeight,
      edited: true,
    })
  }

  // ── Resize handles for user text ─────────────────────────────────────────
  const resizeStart = useRef<{
    x: number
    y: number
    left: number
    top: number
    width: number
    height: number
    handle: string
  } | null>(null)

  function startResize(event: PointerEvent<HTMLDivElement>, handle: string) {
    if (element.locked) return
    event.stopPropagation()
    resizeStart.current = {
      x: event.clientX,
      y: event.clientY,
      left: element.x,
      top: element.y,
      width: element.width,
      height: element.height,
      handle,
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

    let newWidth = rs.width
    let newHeight = rs.height
    let newLeft = rs.left
    let newTop = rs.top

    if (isRight) newWidth = Math.max(60, rs.width + dx)
    else if (isLeft) { newWidth = Math.max(60, rs.width - dx); newLeft = rs.left + (rs.width - newWidth) }
    if (isBottom) newHeight = Math.max(element.fontSize, rs.height + dy)
    else if (isTop) { newHeight = Math.max(element.fontSize, rs.height - dy); newTop = rs.top + (rs.height - newHeight) }

    // Live DOM update for smooth feedback
    const wrapper = (event.currentTarget as HTMLElement).closest('[data-text-element]') as HTMLElement | null
    if (wrapper) {
      wrapper.style.width = `${newWidth * zoom}px`
      wrapper.style.height = `${newHeight * zoom}px`
      wrapper.style.left = `${newLeft * zoom}px`
      wrapper.style.top = `${newTop * zoom}px`
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

    let newWidth = rs.width
    let newHeight = rs.height
    let newLeft = rs.left
    let newTop = rs.top

    if (isRight) newWidth = Math.max(60, rs.width + dx)
    else if (isLeft) { newWidth = Math.max(60, rs.width - dx); newLeft = rs.left + (rs.width - newWidth) }
    if (isBottom) newHeight = Math.max(element.fontSize, rs.height + dy)
    else if (isTop) { newHeight = Math.max(element.fontSize, rs.height - dy); newTop = rs.top + (rs.height - newHeight) }

    // Width or height resized → mark as manual so auto-grow stops
    const widthChanged = isLeft || isRight
    update(element.id, {
      x: newLeft,
      y: newTop,
      width: newWidth,
      height: newHeight,
      ...(widthChanged ? { manualWidth: true } : {}),
    })

    resizeStart.current = null
    event.currentTarget.releasePointerCapture(event.pointerId)
  }

  // ── Shared textarea / span styles ────────────────────────────────────────
  const textStyle: React.CSSProperties = {
    fontSize: element.fontSize * zoom,
    fontFamily: cssFontFamily,
    fontWeight: element.bold ? 'bold' : 'normal',
    fontStyle: element.italic ? 'italic' : 'normal',
    textAlign: element.textAlign ?? 'left',
    color:
      element.link && (element.color === '#1f2937' || element.color === '#000000')
        ? '#2563eb'
        : element.color,
    textDecoration: element.link ? 'underline' : 'none',
    lineHeight: element.lineHeight ?? 1.2,
  }

  const handleStyle: React.CSSProperties = {
    position: 'absolute',
    width: 9,
    height: 9,
    background: 'var(--primary, #2563eb)',
    border: '1.5px solid white',
    borderRadius: '50%',
    zIndex: 30,
    cursor: 'pointer',
  }

  return (
    <div
      data-text-element
      tabIndex={0}
      role="button"
      aria-label={`Text: ${element.text || '(empty)'}`}
      style={{
        position: 'absolute',
        left: rect.left,
        top: rect.top,
        width: Math.max(rect.width, 24),
        minHeight: rect.height,
        transform: `rotate(${rect.rotation}deg)`,
        transformOrigin: 'top left',
        pointerEvents: allowInteraction ? 'auto' : 'none',
        userSelect: 'none',
        outline: selected ? '1.5px solid var(--primary, #2563eb)' : '1px solid transparent',
        borderRadius: 1,
        boxShadow: selected ? '0 0 0 2px color-mix(in srgb, var(--primary) 18%, transparent)' : undefined,
        cursor: isUserText && activeTool === 'pointer' ? (selected ? 'move' : 'pointer') : 'default',
      }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onClick={(e) => {
        // Always stop propagation to prevent PdfPage from deselecting us
        e.stopPropagation()
      }}
      onDoubleClick={() => {
        if (isUserText && activeTool === 'pointer') {
          setIsEditing(true)
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { onSelect(element.id); setIsEditing(true) }
      }}
    >
      {isEditable ? (
        <textarea
          data-editor-input="true"
          aria-label="Edit text content"
          placeholder="Type here..."
          // autoFocus for newly created user text
          autoFocus={isUserText && !element.edited}
          value={element.text}
          onChange={handleTextChange}
          onBlur={() => {
            if (!element.text.trim() && isUserText) {
              remove()
            } else {
              setIsEditing(false)
            }
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          disabled={element.locked}
          wrap="soft"
          style={{
            ...textStyle,
            width: '100%',
            height: '100%',
            background: isPdfText ? 'rgba(255, 255, 255, 0.92)' : 'transparent',
            border: 0,
            outline: 0,
            resize: 'none',
            overflow: 'hidden',
            padding: 0,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            boxSizing: 'border-box',
          }}
        />
      ) : (
        <span
          style={{
            display: 'block',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            ...textStyle,
            // For unedited PDF text, render transparent to not double-paint
            color:
              element.edited || element.source === 'user' || element.link
                ? textStyle.color
                : 'transparent',
            background: element.edited ? 'rgba(255, 255, 255, 0.92)' : 'transparent',
          }}
        >
          {element.text || (isUserText ? <span style={{ color: 'var(--muted, #667085)', opacity: 0.6 }}>Type here…</span> : null)}
        </span>
      )}

      {/* 8-handle resize UI for selected user-added text in pointer mode */}
      {selected && isUserText && activeTool === 'pointer' && !element.locked && (
        <>
          {/* Top-Left */}
          <div style={{ ...handleStyle, top: -5, left: -5, cursor: 'nwse-resize' }}
            onPointerDown={(e) => startResize(e, 'top-left')} onPointerMove={doResize}
            onPointerUp={finishResize} onPointerCancel={finishResize} />
          {/* Top-Center */}
          <div style={{ ...handleStyle, top: -5, left: 'calc(50% - 4.5px)', cursor: 'ns-resize' }}
            onPointerDown={(e) => startResize(e, 'top-center')} onPointerMove={doResize}
            onPointerUp={finishResize} onPointerCancel={finishResize} />
          {/* Top-Right */}
          <div style={{ ...handleStyle, top: -5, right: -5, cursor: 'nesw-resize' }}
            onPointerDown={(e) => startResize(e, 'top-right')} onPointerMove={doResize}
            onPointerUp={finishResize} onPointerCancel={finishResize} />
          {/* Middle-Left */}
          <div style={{ ...handleStyle, top: 'calc(50% - 4.5px)', left: -5, cursor: 'ew-resize' }}
            onPointerDown={(e) => startResize(e, 'middle-left')} onPointerMove={doResize}
            onPointerUp={finishResize} onPointerCancel={finishResize} />
          {/* Middle-Right */}
          <div style={{ ...handleStyle, top: 'calc(50% - 4.5px)', right: -5, cursor: 'ew-resize' }}
            onPointerDown={(e) => startResize(e, 'middle-right')} onPointerMove={doResize}
            onPointerUp={finishResize} onPointerCancel={finishResize} />
          {/* Bottom-Left */}
          <div style={{ ...handleStyle, bottom: -5, left: -5, cursor: 'nesw-resize' }}
            onPointerDown={(e) => startResize(e, 'bottom-left')} onPointerMove={doResize}
            onPointerUp={finishResize} onPointerCancel={finishResize} />
          {/* Bottom-Center */}
          <div style={{ ...handleStyle, bottom: -5, left: 'calc(50% - 4.5px)', cursor: 'ns-resize' }}
            onPointerDown={(e) => startResize(e, 'bottom-center')} onPointerMove={doResize}
            onPointerUp={finishResize} onPointerCancel={finishResize} />
          {/* Bottom-Right */}
          <div style={{ ...handleStyle, bottom: -5, right: -5, cursor: 'nwse-resize' }}
            onPointerDown={(e) => startResize(e, 'bottom-right')} onPointerMove={doResize}
            onPointerUp={finishResize} onPointerCancel={finishResize} />
        </>
      )}
    </div>
  )
}
