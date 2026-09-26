import { create } from 'zustand'
import type { EditorSnapshot, EditorTool, PdfDocumentState, EditorElement, EditorPage } from '../types/editor'

interface EditorStore {
  document: PdfDocumentState | null
  elements: EditorElement[]
  selectedElementId: string | null
  activeTool: EditorTool
  zoom: number
  dirty: boolean
  history: EditorSnapshot[]
  historyIndex: number
  clipboard: EditorElement[] | null
  
  setDocument: (document: PdfDocumentState, elements: EditorElement[]) => void
  setZoom: (zoom: number) => void
  setActiveTool: (tool: EditorTool) => void
  selectElement: (id: string | null) => void
  
  updateElement: (id: string, update: Partial<EditorElement>) => void
  addElement: (element: EditorElement) => void
  
  deleteSelected: () => void
  duplicateSelected: () => void
  copySelected: () => void
  paste: () => void
  bringForward: () => void
  sendBackward: () => void
  toggleLock: () => void
  
  undo: () => void
  redo: () => void
  reset: () => void
  markSaved: (bytes?: ArrayBuffer) => void

  // Page management
  addPage: (pageIndex: number, page: EditorPage) => void
  duplicatePage: (pageIndex: number, newPage: EditorPage) => void
  rotatePage: (pageIndex: number, angle: number) => void
  deletePage: (pageIndex: number) => void
  reorderPage: (fromIndex: number, toIndex: number) => void
  
  drawSettings: { color: string, strokeWidth: number }
  setDrawSettings: (settings: Partial<{ color: string, strokeWidth: number }>) => void
}

const initialState = { history: [] as EditorSnapshot[], historyIndex: -1 }

export const useEditorStore = create<EditorStore>((set, get) => {
  const commit = (elements: EditorElement[], pages?: EditorPage[]) =>
    set((state) => {
      const history = state.history.slice(0, state.historyIndex + 1)
      const currentPages = pages ?? state.document?.pages ?? []
      history.push({ elements, pages: currentPages })
      return { 
        elements, 
        history, 
        historyIndex: history.length - 1, 
        dirty: true,
        document: pages && state.document ? { ...state.document, pages } : state.document 
      }
    })

  return {
    document: null,
    elements: [],
    selectedElementId: null,
    activeTool: 'pointer',
    zoom: 1,
    dirty: false,
    ...initialState,
    drawSettings: { color: '#ef4444', strokeWidth: 3 },
    clipboard: null,
    setDrawSettings: (settings) => set((state) => ({ drawSettings: { ...state.drawSettings, ...settings } })),
    
    setDocument: (document, elements) => set({ 
      document, 
      elements, 
      history: [{ elements, pages: document.pages }], 
      historyIndex: 0, 
      dirty: false, 
      selectedElementId: null 
    }),
    
    setZoom: (zoom) => set({ zoom: Math.min(2.5, Math.max(0.5, zoom)) }),
    setActiveTool: (activeTool) => set({ activeTool }),
    selectElement: (selectedElementId) => set({ selectedElementId }),
    
    updateElement: (id, update) => set((state) => {
      const elements = state.elements.map((element) => 
        element.id === id ? { ...element, ...update, edited: true } as EditorElement : element
      )
      const history = state.history.slice(0, state.historyIndex + 1)
      history.push({ elements, pages: state.document?.pages ?? [] })
      return { elements, history, historyIndex: history.length - 1, dirty: true }
    }),
    
    addElement: (element) => commit([...get().elements, element]),
    
    deleteSelected: () => set((state) => {
      if (!state.selectedElementId) return state
      
      const elements = state.elements.map(el => {
        if (el.id === state.selectedElementId && !el.locked) {
           if (el.type === 'text') {
             return { ...el, text: '', edited: true }
           }
           if (el.type === 'source-image') {
             return { ...el, deleted: true }
           }
        }
        return el
      }).filter(el => {
         if (el.id === state.selectedElementId && !el.locked) {
            if (el.type !== 'text' && el.type !== 'source-image') {
              return false
            }
         }
         return true
      })

      const history = state.history.slice(0, state.historyIndex + 1)
      history.push({ elements, pages: state.document?.pages ?? [] })
      return { elements, history, historyIndex: history.length - 1, dirty: true, selectedElementId: null }
    }),
    
    duplicateSelected: () => set((state) => {
      if (!state.selectedElementId) return state
      const selected = state.elements.find(e => e.id === state.selectedElementId)
      if (!selected) return state

      const newElement = { 
        ...selected, 
        id: crypto.randomUUID(), 
        x: selected.x + 10, 
        y: selected.y + 10,
        edited: true
      } as EditorElement

      const elements = [...state.elements, newElement]
      const history = state.history.slice(0, state.historyIndex + 1)
      history.push({ elements, pages: state.document?.pages ?? [] })
      return { elements, history, historyIndex: history.length - 1, dirty: true, selectedElementId: newElement.id }
    }),
    
    copySelected: () => set((state) => {
      if (!state.selectedElementId) return state
      const selected = state.elements.find(e => e.id === state.selectedElementId)
      if (!selected) return state
      return { clipboard: [{ ...selected }] }
    }),

    paste: () => set((state) => {
      if (!state.clipboard || state.clipboard.length === 0) return state
      
      const newElements = state.clipboard.map(element => ({
        ...element,
        id: crypto.randomUUID(),
        x: element.x + 10,
        y: element.y + 10,
        edited: true
      })) as EditorElement[]

      const elements = [...state.elements, ...newElements]
      const history = state.history.slice(0, state.historyIndex + 1)
      history.push({ elements, pages: state.document?.pages ?? [] })
      return { 
        elements, 
        history, 
        historyIndex: history.length - 1, 
        dirty: true, 
        selectedElementId: newElements[0].id,
        // Update clipboard to allow pasting multiple times with offset
        clipboard: newElements 
      }
    }),

    bringForward: () => set((state) => {
      if (!state.selectedElementId) return state
      const index = state.elements.findIndex(e => e.id === state.selectedElementId)
      if (index === -1 || index === state.elements.length - 1) return state
      
      const elements = [...state.elements]
      const [element] = elements.splice(index, 1)
      elements.push(element) // Move to the very end (Bring to Front)
      
      const history = state.history.slice(0, state.historyIndex + 1)
      history.push({ elements, pages: state.document?.pages ?? [] })
      return { elements, history, historyIndex: history.length - 1, dirty: true }
    }),
    
    sendBackward: () => set((state) => {
      if (!state.selectedElementId) return state
      const index = state.elements.findIndex(e => e.id === state.selectedElementId)
      if (index <= 0) return state
      
      const elements = [...state.elements]
      const [element] = elements.splice(index, 1)
      elements.unshift(element) // Move to the very beginning (Send to Back)
      
      const history = state.history.slice(0, state.historyIndex + 1)
      history.push({ elements, pages: state.document?.pages ?? [] })
      return { elements, history, historyIndex: history.length - 1, dirty: true }
    }),
    
    toggleLock: () => set((state) => {
      if (!state.selectedElementId) return state
      const elements = state.elements.map((element) => 
        element.id === state.selectedElementId ? { ...element, locked: !element.locked } as EditorElement : element
      )
      const history = state.history.slice(0, state.historyIndex + 1)
      history.push({ elements, pages: state.document?.pages ?? [] })
      return { elements, history, historyIndex: history.length - 1, dirty: true }
    }),
    
    undo: () => set((state) => {
      if (state.historyIndex <= 0) return state
      const historyIndex = state.historyIndex - 1
      const snapshot = state.history[historyIndex]
      if (!snapshot) return state

      return { 
        historyIndex, 
        elements: snapshot.elements, 
        document: state.document ? { ...state.document, pages: snapshot.pages } : state.document,
        dirty: true 
      }
    }),
    
    redo: () => set((state) => {
      if (state.historyIndex >= state.history.length - 1) return state
      const historyIndex = state.historyIndex + 1
      const snapshot = state.history[historyIndex]
      if (!snapshot) return state

      return { 
        historyIndex, 
        elements: snapshot.elements,
        document: state.document ? { ...state.document, pages: snapshot.pages } : state.document,
        dirty: true 
      }
    }),
    
    markSaved: (bytes) => set((state) => ({ 
      document: state.document && bytes ? { ...state.document, bytes } : state.document, 
      dirty: false 
    })),
    
    reset: () => set({ 
      document: null, 
      elements: [], 
      selectedElementId: null, 
      zoom: 1, 
      dirty: false, 
      history: [], 
      historyIndex: -1 
    }),

    addPage: (pageIndex, page) => {
      const state = get()
      if (!state.document) return
      const pages = [...state.document.pages]
      pages.splice(pageIndex + 1, 0, page)
      commit(state.elements, pages)
    },

    duplicatePage: (pageIndex, newPage) => {
      const state = get()
      if (!state.document) return
      const pages = [...state.document.pages]
      pages.splice(pageIndex + 1, 0, newPage)
      
      const sourcePageId = state.document.pages[pageIndex].id
      const elementsToDuplicate = state.elements
        .filter(el => el.pageId === sourcePageId)
        .map(el => ({ ...el, id: crypto.randomUUID(), pageId: newPage.id }))
      
      commit([...state.elements, ...elementsToDuplicate], pages)
    },

    rotatePage: (pageIndex, angle) => {
      const state = get()
      if (!state.document) return
      const pages = state.document.pages.map((p, i) => 
        i === pageIndex ? { ...p, rotation: (p.rotation + angle) % 360 } : p
      )
      commit(state.elements, pages)
    },

    deletePage: (pageIndex) => {
      const state = get()
      if (!state.document || state.document.pages.length <= 1) return
      
      const deletedPageId = state.document.pages[pageIndex].id
      const pages = state.document.pages.filter((_, i) => i !== pageIndex)
      
      const elements = state.elements.filter(el => el.pageId !== deletedPageId)
        
      commit(elements, pages)
    },

    reorderPage: (fromIndex, toIndex) => {
      const state = get()
      if (!state.document) return
      const pages = [...state.document.pages]
      const [movedPage] = pages.splice(fromIndex, 1)
      pages.splice(toIndex, 0, movedPage)
      commit(state.elements, pages)
    }
  }
})
