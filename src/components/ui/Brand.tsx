import { PanelsTopLeft } from 'lucide-react'
export function Brand() {
  return (
    <span className="brand">
      <span className="brand-mark">
        <PanelsTopLeft size={18} />
      </span>
      papertrail<span className="brand-dot">.</span>
    </span>
  )
}
