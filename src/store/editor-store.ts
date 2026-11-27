import { create } from 'zustand'
import type { EditorSnapshot, EditorTool, PdfDocumentState, EditorElement, EditorPage, TextElement, WatermarkConfig } from '../types/editor'

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
  watermark?: WatermarkConfig
  
  setWatermark: (config: WatermarkConfig | undefined) => void
  setDocument: (document: PdfDocumentState, elements: EditorElement[]) => void
  setDocumentName: (name: string) => void
  hydrateBackgroundElements: (newElements: EditorElement[]) => void
  applySourceStyles: (stylesById: Map<string, NonNullable<TextElement['sourceStyle']>>) => void
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
  addPages: (pageIndex: number, newPages: EditorPage[]) => void
  duplicatePage: (pageIndex: number, newPage: EditorPage) => void
  rotatePage: (pageIndex: number, angle: number) => void
  deletePage: (pageIndex: number) => void
  reorderPage: (fromIndex: number, toIndex: number) => void
  
  drawSettings: { color: string, strokeWidth: number }
  setDrawSettings: (settings: Partial<{ color: string, strokeWidth: number }>) => void
}

const initialState = { history: [] as EditorSnapshot[], historyIndex: -1 }

export const useEditorStore = create<EditorStore>((set, get) => {
  const commit = (elements: EditorElement[], pages?: EditorPage[], watermark?: WatermarkConfig) =>
    set((state) => {
      const history = state.history.slice(0, state.historyIndex + 1)
      const currentPages = pages ?? state.document?.pages ?? []
      const currentWatermark = watermark !== undefined ? watermark : state.watermark
      history.push({ elements, pages: currentPages, watermark: currentWatermark })
      return { 
        elements, 
        history, 
        watermark: currentWatermark,
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
    
    setWatermark: (watermark) => commit(get().elements, get().document?.pages, watermark),
    
    setDocument: (document, elements) => set({ 
      document, 
      elements, 
      watermark: document.watermark,
      history: [{ elements, pages: document.pages, watermark: document.watermark }], 
      historyIndex: 0, 
      dirty: false, 
      selectedElementId: null 
    }),

    setDocumentName: (name) => set((state) => (
      state.document && state.document.name !== name
        ? { document: { ...state.document, name } }
        : state
    )),

    hydrateBackgroundElements: (newElements) => set((state) => {
      if (!state.document || newElements.length === 0) return state
      const currentPageIds = new Set(state.document.pages.map((p) => p.id))
      const existingIds = new Set(state.elements.map((e) => e.id))
      const toAddCurrent = newElements.filter(
        (el) => currentPageIds.has(el.pageId) && !existingIds.has(el.id),
      )

      const history = state.history.map((snapshot) => {
        const snapPageIds = new Set(snapshot.pages.map((p) => p.id))
        const snapExistingIds = new Set(snapshot.elements.map((e) => e.id))
        const toAddSnap = newElements.filter(
          (el) => snapPageIds.has(el.pageId) && !snapExistingIds.has(el.id),
        )
        return toAddSnap.length > 0
          ? { ...snapshot, elements: [...snapshot.elements, ...toAddSnap] }
          : snapshot
      })

      return {
        elements: toAddCurrent.length > 0 ? [...state.elements, ...toAddCurrent] : state.elements,
        history,
      }
    }),

    applySourceStyles: (stylesById) => set((state) => {
      if (!state.document || stylesById.size === 0) return state
      const patchList = (list: EditorElement[]) => {
        let changed = false
        const next = list.map((el) => {
          if (el.type === 'text' && el.source === 'pdf' && !el.edited && !el.deleted) {
            const enriched = stylesById.get(el.id)
            if (enriched) {
              changed = true
              return { ...el, sourceStyle: enriched }
            }
          }
          return el
        })
        return changed ? next : list
      }

      const elements = patchList(state.elements)
      const history = state.history.map((snapshot) => {
        const nextEls = patchList(snapshot.elements)
        return nextEls !== snapshot.elements ? { ...snapshot, elements: nextEls } : snapshot
      })
      return { elements, history }
    }),
    
    setZoom: (zoom) => set({ zoom: Math.min(2.5, Math.max(0.5, zoom)) }),
    setActiveTool: (activeTool) => set({ activeTool }),
    selectElement: (selectedElementId) => set({ selectedElementId }),
    
    updateElement: (id, update) => set((state) => {
      const elements = state.elements.map((element) => 
        element.id === id ? { ...element, ...update, edited: true } as EditorElement : element
      )
      const history = state.history.slice(0, state.historyIndex + 1)
      history.push({ elements, pages: state.document?.pages ?? [], watermark: state.watermark })
      return { elements, history, historyIndex: history.length - 1, dirty: true }
    }),
    
    addElement: (element) => commit([...get().elements, element]),
    
    deleteSelected: () => set((state) => {
      if (!state.selectedElementId) return state
      
      const elements = state.elements.map(el => {
        if (el.id === state.selectedElementId && !el.locked) {
           if (el.type === 'text' && el.source === 'pdf') {
             return { ...el, deleted: true, edited: true, text: '' }
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
            if (el.type === 'text' && el.source !== 'pdf') {
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
      history.push({ elements, pages: state.document?.pages ?? [], watermark: state.watermark })
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
      history.push({ elements, pages: state.document?.pages ?? [], watermark: state.watermark })
      return { elements, history, historyIndex: history.length - 1, dirty: true }
    }),
    
    toggleLock: () => set((state) => {
      if (!state.selectedElementId) return state
      const elements = state.elements.map((element) => 
        element.id === state.selectedElementId ? { ...element, locked: !element.locked } as EditorElement : element
      )
      const history = state.history.slice(0, state.historyIndex + 1)
      history.push({ elements, pages: state.document?.pages ?? [], watermark: state.watermark })
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
        watermark: snapshot.watermark,
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
        watermark: snapshot.watermark,
        document: state.document ? { ...state.document, pages: snapshot.pages } : state.document,
        dirty: true 
      }
    }),
    
    markSaved: (bytes) => set((state) => ({ 
      document: state.document && bytes ? { ...state.document, bytes } : state.document, 
      dirty: false,
      watermark: state.watermark ? { ...state.watermark, source: 'pdf' } : undefined
    })),
    
      reset: () => set({ 
      document: null, 
      elements: [], 
      watermark: undefined,
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

    addPages: (pageIndex, newPages) => {
      const state = get()
      if (!state.document) return
      const pages = [...state.document.pages]
      pages.splice(pageIndex + 1, 0, ...newPages)
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
      const targetPage = state.document.pages[pageIndex]
      if (!targetPage) return
      
      const deletedPageId = targetPage.id
      const pages = state.document.pages.filter((_, i) => i !== pageIndex)
      
      const elements = state.elements.filter(el => el.pageId !== deletedPageId)
      const selectedWasRemoved = Boolean(
        state.selectedElementId && !elements.some(el => el.id === state.selectedElementId),
      )
        
      commit(elements, pages)
      if (selectedWasRemoved) {
        set({ selectedElementId: null })
      }
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
declare global {
  interface Window {
    useEditorStore?: typeof useEditorStore
  }
}

if (typeof window !== 'undefined') window.useEditorStore = useEditorStore
