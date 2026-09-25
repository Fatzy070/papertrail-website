import { useState, type FormEvent } from 'react'
import { ArrowRight, LoaderCircle, CheckCircle2 } from 'lucide-react'
import { useResendVerification, useVerifyEmail, useLogout } from '../../../hooks/use-auth'
import { useQueryClient } from '@tanstack/react-query'
import { authKeys } from '../../../hooks/use-auth'
import { useNavigate } from 'react-router-dom'
import { CodeBoxes } from '../CodeBoxes'

export function VerifyEmailStep({ email, onBackToLogin }: { email: string, onBackToLogin: () => void }) {
  const [code, setCode] = useState('')
  const [success, setSuccess] = useState(false)
  const verify = useVerifyEmail()
  const resend = useResendVerification()
  const logout = useLogout()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  async function submit(event: FormEvent) {
    event.preventDefault()
    try {
      await verify.mutateAsync({ email, code })
      setSuccess(true)
      // Refetch current user to update emailVerified status and unblock the route
      setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: authKeys.current })
        navigate('/dashboard')
      }, 1500)
    } catch {
      // Error is displayed by the hook/api globally or we could show it inline
    }
  }

  async function handleResend() {
    try {
      if (email) {
        await resend.mutateAsync({ email })
        alert('Verification code resent!')
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to resend code')
    }
  }

  async function handleSignOut() {
    await logout.mutateAsync()
    onBackToLogin()
  }

  if (success) {
    return (
      <div style={{ textAlign: 'center' }}>
        <CheckCircle2 size={48} className="text-green-500 mb-4 mx-auto" />
        <h1>Email verified</h1>
        <p className="muted">
          Redirecting you to your workspace...
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="auth-symbol">
        <ArrowRight size={22} />
      </div>
      <h1>Verify your email</h1>
      <p className="muted">
        We sent a 6-digit code to <strong>{email}</strong>. Enter it below to access your workspace.
      </p>
      
      <form onSubmit={(e) => void submit(e)} className="auth-form">
        <label className="field-label">
          Verification code
          <CodeBoxes value={code} onChange={setCode} disabled={verify.isPending} />
        </label>

        {verify.error && (
          <p role="alert" className="error-message">
            {verify.error.message}
          </p>
        )}
        
        <button
          className="primary-button auth-submit"
          disabled={verify.isPending || code.length < 6}
        >
          {verify.isPending ? (
            <LoaderCircle size={16} className="animate-spin" />
          ) : null}
          Verify email
          <ArrowRight size={16} />
        </button>
      </form>
      
      <p className="auth-switch" style={{ marginTop: '24px' }}>
        Didn't receive it?{' '}
        <button 
          type="button" 
          onClick={() => void handleResend()} 
          disabled={resend.isPending}
          style={{ background: 'none', border: 'none', padding: 0, fontSize: '1rem', fontWeight: 500, color: 'var(--brand-color)', cursor: 'pointer', textDecoration: 'underline' }}
        >
          {resend.isPending ? 'Sending...' : 'Resend code'}
        </button>
      </p>

      <div style={{ textAlign: 'center', marginTop: '16px' }}>
        <button 
          type="button" 
          onClick={() => void handleSignOut()} 
          style={{ background: 'none', border: 'none', padding: 0, fontSize: '0.875rem', color: 'var(--muted-color)', cursor: 'pointer', textDecoration: 'underline' }}
        >
          Sign in as a different user
        </button>
      </div>
    </>
  )
}
