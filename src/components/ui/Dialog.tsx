import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

export function Dialog({
  title,
  description,
  children,
  onClose,
}: {
  title: string
  description?: string
  children: ReactNode
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const id = useId()
  useEffect(() => {
    const dialog = ref.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])
  return (
    <dialog
      ref={ref}
      className="app-dialog"
      aria-labelledby={id}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="flex items-center justify-between gap-[15px]">
        <h2 id={id} className="m-0 text-[19px] tracking-[-0.02em]">{title}</h2>
        <button
          className="inline-flex items-center justify-center w-[34px] h-[34px] p-0 rounded-[9px] bg-transparent text-[var(--muted)] font-[650] cursor-pointer transition-colors duration-150 hover:bg-[var(--surface-hover)] hover:text-[var(--text)] border-0"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>
      {description && <p className="mt-2 mb-[22px] text-[12px] leading-[1.6] text-[var(--muted)]">{description}</p>}
      {children}
    </dialog>
  )
}
