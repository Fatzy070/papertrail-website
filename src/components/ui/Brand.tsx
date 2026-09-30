export function Brand({ className = '' }: { className?: string }) {
  return (
    <span className={`brand ${className}`}>
      <span className="brand-mark">
        <img src="/logo.png" alt="Papertrail" className="brand-logo-img" />
      </span>
      papertrail<span className="brand-dot">.</span>
    </span>
  )
}
