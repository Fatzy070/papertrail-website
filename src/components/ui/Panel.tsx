import type { PropsWithChildren } from 'react'

export function Panel({ children, className = '' }: PropsWithChildren<{ className?: string }>) {
  return <section className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>{children}</section>
}
