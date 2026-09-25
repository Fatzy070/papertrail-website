import { create } from 'zustand'

export type ToastKind = 'success' | 'error' | 'info'
export interface Toast { id: number; message: string; kind: ToastKind }

interface ToastStore {
  toasts: Toast[]
  show: (message: string, kind?: ToastKind) => void
  dismiss: (id: number) => void
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  show: (message, kind = 'info') => {
    const id = Date.now()
    set((state) => ({ toasts: [...state.toasts, { id, message, kind }] }))
    window.setTimeout(() => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })), 4000)
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}))
