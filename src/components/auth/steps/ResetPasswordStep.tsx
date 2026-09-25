import { useState, type FormEvent } from 'react'
import { ArrowRight, Eye, EyeOff, LoaderCircle, CheckCircle2 } from 'lucide-react'
import { useResetPassword } from '../../../hooks/use-auth'

export function ResetPasswordStep({ email, onBackToLogin }: { email: string; onBackToLogin: () => void }) {
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [visible, setVisible] = useState(false)
  const [success, setSuccess] = useState(false)
  const resetPassword = useResetPassword()

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (password !== confirmPassword) {
      alert("Passwords don't match")
      return
    }
    if (!email || !code) return

    try {
      await resetPassword.mutateAsync({ email, code, password })
      setSuccess(true)
    } catch {
      // Error is displayed by the hook/api
    }
  }

  if (!email) {
    return (
      <div className="text-center">
        <h1>Missing Information</h1>
        <p className="muted">Please restart the password reset process.</p>
        <button type="button" onClick={onBackToLogin} className="primary-button auth-submit mt-6">
          Go back to login
        </button>
      </div>
    )
  }

  if (success) {
    return (
      <div className="text-center">
        <CheckCircle2 size={48} className="text-green-500 mb-4 mx-auto" />
        <h1>Password reset successfully</h1>
        <p className="muted">
          Your password has been changed. You can now sign in with your new password.
        </p>
        <button type="button" onClick={onBackToLogin} className="primary-button auth-submit mt-6">
          Continue to login
        </button>
      </div>
    )
  }

  return (
    <>
      <div className="auth-symbol">
        <ArrowRight size={22} />
      </div>
      <h1>Create new password</h1>
      <p className="muted">
        We sent a 6-digit code to {email}. Enter it below with your new password.
      </p>
      
      <form onSubmit={(e) => void submit(e)} className="auth-form">
        <label className="field-label">
          Verification code
          <input
            type="text"
            className="text-input"
            placeholder="123456"
            required
            maxLength={6}
            pattern="\d{6}"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </label>
        
        <label className="field-label">
          New password
          <span className="password-field">
            <input
              type={visible ? 'text' : 'password'}
              autoComplete="new-password"
              className="text-input"
              placeholder="At least 8 characters"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="icon-button"
              aria-label={visible ? 'Hide password' : 'Show password'}
              onClick={() => setVisible(!visible)}
            >
              {visible ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </span>
        </label>

        <label className="field-label">
          Confirm new password
          <input
            type={visible ? 'text' : 'password'}
            autoComplete="new-password"
            className="text-input"
            placeholder="Repeat your password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </label>

        {resetPassword.error && (
          <p role="alert" className="error-message">
            {resetPassword.error.message}
          </p>
        )}

        <button
          className="primary-button auth-submit"
          disabled={resetPassword.isPending || password !== confirmPassword}
        >
          {resetPassword.isPending ? (
            <LoaderCircle size={16} className="animate-spin" />
          ) : null}
          Reset password
          <ArrowRight size={16} />
        </button>
      </form>
    </>
  )
}
