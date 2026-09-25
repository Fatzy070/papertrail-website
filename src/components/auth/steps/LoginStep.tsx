import { useState, type FormEvent } from 'react'
import { ArrowRight, Eye, EyeOff, LoaderCircle } from 'lucide-react'
import { useLogin } from '../../../hooks/use-auth'

export function LoginStep({ 
  onSwitchMode, 
  onForgotPassword, 
  onNeedsVerification 
}: { 
  onSwitchMode: () => void, 
  onForgotPassword: () => void,
  onNeedsVerification: (email: string) => void 
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)
  const login = useLogin()

  async function submit(event: FormEvent) {
    event.preventDefault()
    try {
      await login.mutateAsync({ email, password })
    } catch (err: any) {
      if (err?.response?.data?.message === 'EMAIL_NOT_VERIFIED') {
        onNeedsVerification(email)
      }
    }
  }

  return (
    <>
      <div className="auth-symbol">
        <ArrowRight size={22} />
      </div>
      <h1>Welcome back.</h1>
      <p className="muted">Sign in to pick up where you left off.</p>
      
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
        
        <label className="field-label">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span>Password</span>
            <button type="button" onClick={onForgotPassword} style={{ background: 'none', border: 'none', padding: 0, fontSize: '0.875rem', fontWeight: 500, color: 'var(--brand-color)', cursor: 'pointer' }}>
              Forgot password?
            </button>
          </div>
          <span className="password-field">
            <input
              type={visible ? 'text' : 'password'}
              autoComplete="current-password"
              className="text-input"
              placeholder="Enter your password"
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
        
        {login.error && (login.error as any).response?.data?.message !== 'EMAIL_NOT_VERIFIED' && (
          <p role="alert" className="error-message">
            {(login.error as any).response?.data?.message || login.error.message}
          </p>
        )}
        
        <button
          className="primary-button auth-submit"
          disabled={login.isPending}
        >
          {login.isPending ? (
            <LoaderCircle size={16} className="animate-spin" />
          ) : null}
          Sign in
          <ArrowRight size={16} />
        </button>
      </form>
      
      <p className="auth-switch">
        New to Papertrail?{' '}
        <button type="button" onClick={onSwitchMode} style={{ background: 'none', border: 'none', padding: 0, fontSize: '1rem', fontWeight: 500, color: 'var(--brand-color)', cursor: 'pointer', textDecoration: 'underline' }}>
          Create an account
        </button>
      </p>
    </>
  )
}
