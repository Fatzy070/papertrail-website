import { useState, type FormEvent } from 'react'
import { ArrowRight, LoaderCircle } from 'lucide-react'
import { useForgotPassword } from '../../../hooks/use-auth'

export function ForgotPasswordStep({ 
  onBackToLogin, 
  onCodeSent 
}: { 
  onBackToLogin: () => void, 
  onCodeSent: (email: string) => void 
}) {
  const [email, setEmail] = useState('')
  const forgotPassword = useForgotPassword()

  async function submit(event: FormEvent) {
    event.preventDefault()
    try {
      await forgotPassword.mutateAsync({ email })
      onCodeSent(email)
    } catch {
      // Show success anyway to prevent enumeration
      onCodeSent(email)
    }
  }

  return (
    <>
      <div className="auth-symbol">
        <ArrowRight size={22} />
      </div>
      <h1>Forgot password?</h1>
      <p className="muted">
        Enter your email address and we'll send you a link to reset your password.
      </p>
      
      <form onSubmit={(e) => void submit(e)} className="auth-form">
        <label className="field-label">
          Email address
          <input
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            className="text-input"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        
        <button
          className="primary-button auth-submit"
          disabled={forgotPassword.isPending}
        >
          {forgotPassword.isPending ? (
            <LoaderCircle size={16} className="animate-spin" />
          ) : null}
          Send reset code
          <ArrowRight size={16} />
        </button>
      </form>
      
      <p className="auth-switch">
        Remember your password?{' '}
        <button type="button" onClick={onBackToLogin} className="auth-link-button">
          Sign in
        </button>
      </p>
    </>
  )
}
