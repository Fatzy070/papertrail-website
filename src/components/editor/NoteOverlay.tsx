import { useRef, useEffect, useState } from 'react'
import { MessageSquare } from 'lucide-react'
import type { NoteElement } from '../../types/editor'
import { useEditorStore } from '../../store/editor-store'

interface Props {
  element: NoteElement
  zoom: number
  onSelect: (id: string) => void
}

export function NoteOverlay({ element, zoom, onSelect }: Props) {
  const selectedId = useEditorStore((state) => state.selectedElementId)
  const updateElement = useEditorStore((state) => state.updateElement)
  const activeTool = useEditorStore((state) => state.activeTool)
  
  const isSelected = selectedId === element.id
  const [isOpen, setIsOpen] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const start = useRef<{ x: number; y: number; left: number; top: number } | null>(null)

  useEffect(() => {
    if (isSelected && activeTool === 'pointer' && isOpen) {
      textareaRef.current?.focus()
    }
  }, [isSelected, activeTool, isOpen])

  // Open popover automatically on single click if it's selected, otherwise it will just select first.
  // Actually, let's toggle popover on double click, or just keep it open when selected.
  // We'll open it if selected and clicked.
  useEffect(() => {
    if (!isSelected) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsOpen(false)
    }
  }, [isSelected])

  return (
    <div
      style={{
        position: 'absolute',
        left: element.x * zoom,
        top: element.y * zoom,
        width: 24 * zoom,
        height: 24 * zoom,
        cursor: activeTool === 'pointer' ? 'move' : 'default',
        pointerEvents: activeTool === 'pointer' ? 'auto' : 'none',
      }}
      onClick={(e) => {
        e.stopPropagation()
        if (activeTool === 'pointer') {
          onSelect(element.id)
          setIsOpen(true)
        }
      }}
      onPointerDown={(e) => {
        if (activeTool !== 'pointer') return
        e.currentTarget.setPointerCapture(e.pointerId)
        start.current = {
          x: e.clientX,
          y: e.clientY,
          left: element.x,
          top: element.y
        }
      }}
      onPointerMove={(e) => {
        if (!start.current) return
        const dx = (e.clientX - start.current.x) / zoom
        const dy = (e.clientY - start.current.y) / zoom
        e.currentTarget.style.left = `${(start.current.left + dx) * zoom}px`
        e.currentTarget.style.top = `${(start.current.top + dy) * zoom}px`
      }}
      onPointerUp={(e) => {
        if (!start.current) return
        const dx = (e.clientX - start.current.x) / zoom
        const dy = (e.clientY - start.current.y) / zoom
        if (Math.abs(dx) + Math.abs(dy) > 3) {
          updateElement(element.id, {
            x: start.current.left + dx,
            y: start.current.top + dy,
          })
        }
        start.current = null
        e.currentTarget.releasePointerCapture(e.pointerId)
      }}
      onPointerCancel={(e) => {
        start.current = null
        e.currentTarget.releasePointerCapture(e.pointerId)
      }}
    >
      <div style={{ 
        color: element.color || '#eab308', 
        filter: isSelected ? 'drop-shadow(0 0 2px rgba(37,99,235,0.8))' : 'drop-shadow(0 2px 2px rgba(0,0,0,0.2))'
      }}>
        <MessageSquare size={24 * zoom} fill="currentColor" />
      </div>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            left: 28 * zoom,
            top: 0,
            width: Math.max(150, element.width) * zoom,
            minHeight: Math.max(100, element.height) * zoom,
            backgroundColor: '#ffffff',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            borderRadius: '6px',
            border: '1px solid #e5e7eb',
            padding: '8px',
            zIndex: 100,
            cursor: 'default',
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{
            fontSize: '11px',
            color: '#6b7280',
            marginBottom: '4px',
            fontWeight: 500,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            {element.author || 'User'}
            <button 
              onClick={() => setIsOpen(false)}
              style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9ca3af' }}
            >
              ×
            </button>
          </div>
          <textarea
            data-editor-input="true"
            ref={textareaRef}
            value={element.text}
            onChange={(e) => updateElement(element.id, { text: e.target.value })}
            style={{
              width: '100%',
              minHeight: '80px',
              resize: 'vertical',
              border: 'none',
              background: 'transparent',
              outline: 'none',
              fontSize: '14px',
              fontFamily: 'sans-serif',
              color: '#374151',
            }}
            placeholder="Add note..."
          />
        </div>
      )}
    </div>
  )
}
