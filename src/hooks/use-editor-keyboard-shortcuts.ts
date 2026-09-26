import { useEffect } from 'react'
import { useEditorStore } from '../store/editor-store'

function isEditableTarget(target: EventTarget | null): boolean {
  if (!target) return false
  if (target instanceof Element && target.hasAttribute('data-editor-input')) {
    // This input is explicitly part of the editor's history system,
    // so we return false to let the editor shortcut handler process it.
    return false
  }
  if (target instanceof HTMLInputElement) {
    // Inputs like text, password, number, email, etc.
    // Exclude button, checkbox, radio since they don't have text selection to undo.
    const type = target.type
    return !['button', 'checkbox', 'radio', 'submit', 'reset', 'image', 'file'].includes(type)
  }
  if (target instanceof HTMLTextAreaElement) {
    return true
  }
  if (target instanceof HTMLElement && target.isContentEditable) {
    return true
  }
  return false
}

export function useEditorKeyboardShortcuts() {
  const undo = useEditorStore((s) => s.undo)
  const redo = useEditorStore((s) => s.redo)

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
      const modifier = isMac ? event.metaKey : event.ctrlKey

      if (modifier && !event.altKey) {
        // Ctrl/Cmd + Z
        if (event.key.toLowerCase() === 'z') {
          // Ignore if user is typing in a text field
          if (isEditableTarget(event.target)) {
            return
          }

          event.preventDefault()
          if (event.shiftKey) {
            // Ctrl/Cmd + Shift + Z -> Redo
            redo()
          } else {
            // Ctrl/Cmd + Z -> Undo
            undo()
          }
        }

        // Ctrl + Y -> Redo (usually not Cmd + Y on Mac, but we support it if they press it)
        if (event.key.toLowerCase() === 'y' && !event.shiftKey) {
          if (isEditableTarget(event.target)) {
            return
          }
          event.preventDefault()
          redo()
        }

        // Ctrl/Cmd + D -> Duplicate
        if (event.key.toLowerCase() === 'd') {
          if (isEditableTarget(event.target)) return
          event.preventDefault()
          useEditorStore.getState().duplicateSelected()
        }

        // Ctrl/Cmd + C -> Copy
        if (event.key.toLowerCase() === 'c') {
          if (isEditableTarget(event.target)) return
          // We don't necessarily prevent default here if they are copying text outside inputs?
          // But to be safe, if we have an element selected, we copy it.
          if (useEditorStore.getState().selectedElementId) {
            useEditorStore.getState().copySelected()
          }
        }

        // Ctrl/Cmd + V -> Paste
        if (event.key.toLowerCase() === 'v') {
          if (isEditableTarget(event.target)) return
          useEditorStore.getState().paste()
        }
      } else if (!modifier) {
        // Arrow key nudging
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
          if (isEditableTarget(event.target)) return
          
          const state = useEditorStore.getState()
          if (state.activeTool === 'pointer' && state.selectedElementId) {
            const el = state.elements.find(e => e.id === state.selectedElementId)
            if (el) {
              event.preventDefault() // prevent page scrolling
              const shift = event.shiftKey ? 10 : 1
              if (event.key === 'ArrowUp') state.updateElement(el.id, { y: el.y - shift })
              if (event.key === 'ArrowDown') state.updateElement(el.id, { y: el.y + shift })
              if (event.key === 'ArrowLeft') state.updateElement(el.id, { x: el.x - shift })
              if (event.key === 'ArrowRight') state.updateElement(el.id, { x: el.x + shift })
            }
          }
        }
      }
    }

    // Attach to window to catch shortcuts globally when the editor is open
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [undo, redo])
}
