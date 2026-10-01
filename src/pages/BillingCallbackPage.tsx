import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Check, CheckCircle2, Download, Loader2, XCircle } from 'lucide-react'
import { useVerifyTransaction } from '../hooks/use-billing'

const PENDING_EXPORT_KEY = 'papertrail_pending_export'

export interface PendingExport {
  documentId: string
  documentPath: string
}

function readPendingExport(): PendingExport | null {
  try {
    const raw = localStorage.getItem(PENDING_EXPORT_KEY)
    return raw ? JSON.parse(raw) as PendingExport : null
  } catch {
    return null
  }
}

export function BillingCallbackPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const verifyMutation = useVerifyTransaction()
  const reference = searchParams.get('reference')
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>(
    () => (reference ? 'verifying' : 'error'),
  )
  const [errorMessage, setErrorMessage] = useState(
    () => (reference ? '' : 'No payment reference found.'),
  )
  const [pendingExport] = useState<PendingExport | null>(readPendingExport)
  const didVerify = useRef(false)

  useEffect(() => {
    if (didVerify.current) return
    didVerify.current = true

    if (!reference) return

    verifyMutation.mutate(
      { reference, documentId: pendingExport?.documentId },
      {
        onSuccess: () => {
          setStatus('success')
          localStorage.removeItem(PENDING_EXPORT_KEY)
        },
        onError: (error: unknown) => {
          setStatus('error')
          setErrorMessage(error instanceof Error ? error.message : 'Payment verification failed.')
        },
      },
    )
    // Verification must run once for the payment-provider return URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleContinue() {
    if (pendingExport) {
      navigate(`${pendingExport.documentPath}?autoDownload=1`, { replace: true })
      return
    }

    navigate('/dashboard', { replace: true })
  }

  return (
    <main className="payment-callback" aria-live="polite">
      <section className="payment-callback-card">
        {status === 'verifying' && <VerifyingState />}
        {status === 'success' && (
          <SuccessState pendingExport={Boolean(pendingExport)} onContinue={handleContinue} />
        )}
        {status === 'error' && (
          <ErrorState
            message={errorMessage}
            onDashboard={() => navigate('/dashboard')}
            onRetry={() => window.location.reload()}
          />
        )}
      </section>
    </main>
  )
}

function VerifyingState() {
  return (
    <div className="payment-state">
      <div className="payment-status-icon is-verifying" aria-hidden="true">
        <Loader2 />
      </div>
      <div className="payment-copy">
        <p className="payment-eyebrow">Secure checkout</p>
        <h1>Confirming your payment</h1>
        <p>We’re securely confirming your transaction. This usually takes only a moment.</p>
      </div>
      <div className="payment-progress" aria-label="Payment confirmation in progress">
        <span className="is-complete"><Check size={12} /> Payment received</span>
        <span className="payment-progress-line" />
        <span className="is-current"><Loader2 size={12} /> Unlocking access</span>
      </div>
      <p className="payment-helper">Please keep this page open while we finish.</p>
    </div>
  )
}

function SuccessState({ pendingExport, onContinue }: { pendingExport: boolean; onContinue: () => void }) {
  return (
    <div className="payment-state">
      <div className="payment-status-icon is-success" aria-hidden="true">
        <CheckCircle2 />
      </div>
      <div className="payment-copy">
        <p className="payment-eyebrow">Payment confirmed</p>
        <h1>You’re all set.</h1>
        <p>
          {pendingExport
            ? 'Your export is ready. Continue to download your updated document.'
            : 'Your access has been unlocked and is ready when you are.'}
        </p>
      </div>
      <div className="payment-confirmation" aria-label="Payment completed successfully">
        <Check size={15} />
        <span>Access successfully unlocked</span>
      </div>
      <button className="primary-button payment-action" type="button" onClick={onContinue}>
        {pendingExport ? <Download size={17} /> : null}
        {pendingExport ? 'Continue & download' : 'Return to dashboard'}
      </button>
    </div>
  )
}

function ErrorState({
  message,
  onDashboard,
  onRetry,
}: {
  message: string
  onDashboard: () => void
  onRetry: () => void
}) {
  return (
    <div className="payment-state">
      <div className="payment-status-icon is-error" aria-hidden="true">
        <XCircle />
      </div>
      <div className="payment-copy">
        <p className="payment-eyebrow">Something needs attention</p>
        <h1>We couldn’t verify your payment</h1>
        <p>{message}</p>
      </div>
      <div className="payment-actions">
        <button className="toolbar-button bordered" type="button" onClick={onDashboard}>
          Go to dashboard
        </button>
        <button className="primary-button" type="button" onClick={onRetry}>Try again</button>
      </div>
    </div>
  )
}
