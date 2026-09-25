import { create } from 'zustand'
import type { EditorSnapshot, EditorTool, PdfDocumentState, TextElement } from '../types/editor'

interface EditorStore {
  document: PdfDocumentState | null
  textElements: TextElement[]
  selectedElementId: string | null
  activeTool: EditorTool
  zoom: number
  dirty: boolean
  history: EditorSnapshot[]
  historyIndex: number
  setDocument: (document: PdfDocumentState, elements: TextElement[]) => void
  setZoom: (zoom: number) => void
  setActiveTool: (tool: EditorTool) => void
  selectElement: (id: string | null) => void
  updateElement: (id: string, update: Partial<TextElement>) => void
  addTextElement: (element: TextElement) => void
  deleteSelected: () => void
  undo: () => void
  redo: () => void
  reset: () => void
  markSaved: (bytes?: ArrayBuffer) => void
}

const initialState = { history: [] as EditorSnapshot[], historyIndex: -1 }

export const useEditorStore = create<EditorStore>((set) => {
  const commit = (elements: TextElement[]) =>
    set((state) => {
      const history = state.history.slice(0, state.historyIndex + 1)
      history.push({ textElements: elements })
      return { textElements: elements, history, historyIndex: history.length - 1, dirty: true }
    })

  return {
    document: null,
    textElements: [],
    selectedElementId: null,
    activeTool: 'select',
    zoom: 1,
    dirty: false,
    ...initialState,
    setDocument: (document, elements) => set({ document, textElements: elements, history: [{ textElements: elements }], historyIndex: 0, dirty: false, selectedElementId: null }),
    setZoom: (zoom) => set({ zoom: Math.min(2.5, Math.max(0.5, zoom)) }),
    setActiveTool: (activeTool) => set({ activeTool }),
    selectElement: (selectedElementId) => set({ selectedElementId }),
    updateElement: (id, update) => set((state) => {
      const elements = state.textElements.map((element) => element.id === id ? { ...element, ...update, edited: true } : element)
      const history = state.history.slice(0, state.historyIndex + 1)
      history.push({ textElements: elements })
      return { textElements: elements, history, historyIndex: history.length - 1, dirty: true }
    }),
    addTextElement: (element) => commit([...useEditorStore.getState().textElements, element]),
    deleteSelected: () => set((state) => {
      if (!state.selectedElementId) return state
      const elements = state.textElements.map((element) => element.id === state.selectedElementId ? { ...element, text: '', edited: true } : element)
      const history = state.history.slice(0, state.historyIndex + 1)
      history.push({ textElements: elements })
      return { textElements: elements, history, historyIndex: history.length - 1, dirty: true, selectedElementId: null }
    }),
    undo: () => set((state) => {
      if (state.historyIndex <= 0) return state
      const historyIndex = state.historyIndex - 1
      return { historyIndex, textElements: state.history[historyIndex]?.textElements ?? state.textElements, dirty: true }
    }),
    redo: () => set((state) => {
      if (state.historyIndex >= state.history.length - 1) return state
      const historyIndex = state.historyIndex + 1
      return { historyIndex, textElements: state.history[historyIndex]?.textElements ?? state.textElements, dirty: true }
    }),
    markSaved: (bytes) => set((state) => ({ document: state.document && bytes ? { ...state.document, bytes } : state.document, dirty: false })),
    reset: () => set({ document: null, textElements: [], selectedElementId: null, zoom: 1, dirty: false, history: [], historyIndex: -1 }),
  }
})
