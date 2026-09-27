import { create } from 'zustand'

interface SearchStore {
  isOpen: boolean
  query: string
  activeMatchIndex: number
  
  setOpen: (isOpen: boolean) => void
  setQuery: (query: string) => void
  setActiveMatchIndex: (index: number) => void
  nextMatch: (total: number) => void
  prevMatch: (total: number) => void
  reset: () => void
}

export const useSearchStore = create<SearchStore>((set) => ({
  isOpen: false,
  query: '',
  activeMatchIndex: -1,
  
  setOpen: (isOpen) => set(() => {
    if (!isOpen) {
      // Clear query when closing so reopening starts fresh, per standard UX,
      // or we can keep it. We'll keep the query but just hide the bar.
      // But we should reset the active match index.
      return { isOpen, activeMatchIndex: -1 }
    }
    return { isOpen }
  }),
  
  setQuery: (query) => set({ query, activeMatchIndex: query.trim() ? 0 : -1 }),
  
  setActiveMatchIndex: (index) => set({ activeMatchIndex: index }),
  
  nextMatch: (total) => set((state) => {
    if (total === 0) return { activeMatchIndex: -1 }
    if (state.activeMatchIndex === -1) return { activeMatchIndex: 0 }
    return { activeMatchIndex: (state.activeMatchIndex + 1) % total }
  }),
  
  prevMatch: (total) => set((state) => {
    if (total === 0) return { activeMatchIndex: -1 }
    if (state.activeMatchIndex <= 0) return { activeMatchIndex: total - 1 }
    return { activeMatchIndex: state.activeMatchIndex - 1 }
  }),
  
  reset: () => set({ isOpen: false, query: '', activeMatchIndex: -1 })
}))
