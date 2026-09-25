import { LoaderCircle } from 'lucide-react'
export function LoadingState({
  label = 'Loading your workspace',
}: {
  label?: string
}) {
  return (
    <div className="loading-state" role="status">
      <LoaderCircle size={24} className="animate-spin" />
      <p>{label}</p>
      <span>Just a moment…</span>
    </div>
  )
}
