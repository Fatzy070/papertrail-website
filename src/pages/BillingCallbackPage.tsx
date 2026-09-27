import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useVerifyTransaction } from '../hooks/use-billing';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

const PENDING_EXPORT_KEY = 'papertrail_pending_export';

export interface PendingExport {
  documentId: string;
  documentPath: string; // e.g. /documents/abc123/edit
}

export function BillingCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const verifyMutation = useVerifyTransaction();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [errorMessage, setErrorMessage] = useState('');
  const [pendingExport, setPendingExport] = useState<PendingExport | null>(null);
  const didVerify = useRef(false);

  useEffect(() => {
    if (didVerify.current) return;
    didVerify.current = true;

    const reference = searchParams.get('reference');
    if (!reference) {
      setStatus('error');
      setErrorMessage('No payment reference found.');
      return;
    }

    // Read pending export intent saved before Paystack redirect
    let pending: PendingExport | null = null;
    try {
      const raw = localStorage.getItem(PENDING_EXPORT_KEY);
      if (raw) pending = JSON.parse(raw) as PendingExport;
    } catch {
      // ignore parse errors
    }
    setPendingExport(pending);

    verifyMutation.mutate(
      { reference, documentId: pending?.documentId },
      {
        onSuccess: () => {
          setStatus('success');
          // Clear pending intent now that verification succeeded
          localStorage.removeItem(PENDING_EXPORT_KEY);
        },
        onError: (err: unknown) => {
          setStatus('error');
          setErrorMessage(
            err instanceof Error ? err.message : 'Payment verification failed.',
          );
        },
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleContinue() {
    if (pendingExport) {
      // Return to the editor with a signal to auto-download
      navigate(`${pendingExport.documentPath}?autoDownload=1`, { replace: true });
    } else {
      navigate('/dashboard', { replace: true });
    }
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-gray-50/50">
      <div className="w-full max-w-md rounded-xl border bg-white p-8 shadow-sm text-center">
        {status === 'verifying' && (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
            <h2 className="text-xl font-semibold">Verifying your payment</h2>
            <p className="text-sm text-gray-500">Please wait while we confirm your transaction...</p>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center gap-4">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
            <h2 className="text-xl font-semibold">Payment Successful!</h2>
            <p className="text-sm text-gray-500">Your access has been unlocked.</p>
            <button
              className="mt-4 w-full rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              onClick={handleContinue}
            >
              {pendingExport ? 'Continue & Download' : 'Return to Dashboard'}
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center gap-4">
            <XCircle className="h-12 w-12 text-red-500" />
            <h2 className="text-xl font-semibold">Verification Failed</h2>
            <p className="text-sm text-red-600">{errorMessage}</p>
            <div className="mt-4 flex w-full gap-3">
              <button
                className="w-full rounded border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50"
                onClick={() => navigate('/dashboard')}
              >
                Go to Dashboard
              </button>
              <button
                className="w-full rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                onClick={() => window.location.reload()}
              >
                Try Again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
