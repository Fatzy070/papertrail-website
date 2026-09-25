import { CheckCircle2, CircleAlert, Info, X } from 'lucide-react'
import { useToastStore } from '../../store/toast-store'

export function ToastViewport() {
  const toasts = useToastStore((state) => state.toasts)
  const dismiss = useToastStore((state) => state.dismiss)
  return (
    <div className="toast-viewport" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className="toast-item">
          {toast.kind === 'success' ? (
            <CheckCircle2 className="text-emerald-600" size={19} />
          ) : toast.kind === 'error' ? (
            <CircleAlert className="text-red-600" size={19} />
          ) : (
            <Info className="text-blue-600" size={19} />
          )}
          <p className="flex-1 text-sm text-slate-700">{toast.message}</p>
          <button
            className="icon-button"
            onClick={() => dismiss(toast.id)}
            aria-label="Dismiss notification"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  )
}
