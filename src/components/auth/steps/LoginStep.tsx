import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowRight, Eye, EyeOff, LoaderCircle } from 'lucide-react'
import { useGoogleLogin, useLogin } from '../../../hooks/use-auth'
import { useNavigate } from 'react-router-dom'

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
  const google = useGoogleLogin()
  const navigate = useNavigate()

  async function submit(event: FormEvent) {
    event.preventDefault()
    try {
      await login.mutateAsync({ email, password })
    } catch (err: unknown) {
      if (err instanceof Error && err.message.toLowerCase().includes('verify your email')) {
        onNeedsVerification(email)
      }
    }
  }

  const googleButton = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
    if (!clientId || !googleButton.current) return
    const render = () => {
      const googleWindow = window as typeof window & { google?: { accounts: { id: { initialize: (config: { client_id: string; callback: (response: { credential: string }) => void }) => void; renderButton: (element: HTMLElement, options: { theme: string; size: string; width: number; text: string }) => void } } } }
      if (!googleWindow.google || !googleButton.current) return
      googleWindow.google.accounts.id.initialize({ client_id: clientId, callback: (response) => { void google.mutateAsync(response.credential).then(() => navigate('/dashboard', { replace: true })) } })
      googleButton.current.replaceChildren()
      googleWindow.google.accounts.id.renderButton(googleButton.current, { theme: 'outline', size: 'large', width: 360, text: 'continue_with' })
    }
    if (document.querySelector('script[src="https://accounts.google.com/gsi/client"]')) { render(); return }
    const script = document.createElement('script'); script.src = 'https://accounts.google.com/gsi/client'; script.async = true; script.defer = true; script.onload = render; document.head.appendChild(script)
  }, [google, navigate])

  return (
    <>
      <div className="auth-symbol">
        <ArrowRight size={22} />
      </div>
      <h1>Welcome back.</h1>
      <p className="muted">Sign in to pick up where you left off.</p>
      
      <form onSubmit={(e) => void submit(e)} className="auth-form">
        <div ref={googleButton} className="google-button-host" aria-label="Continue with Google">{google.isPending && <span className="google-loading"><LoaderCircle size={16} className="animate-spin" /> Signing in…</span>}</div>
        <div className="auth-divider"><span>or continue with email</span></div>
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
          <div className="flex-between">
            <span>Password</span>
            <button type="button" onClick={onForgotPassword} className="auth-link-button">
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
        
        {login.error && !login.error.message.toLowerCase().includes('verify your email') && (
          <p role="alert" className="error-message">
            {login.error.message}
          </p>
        )}
        {google.error && <p role="alert" className="error-message">{google.error.message}</p>}
        
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
        <button type="button" onClick={onSwitchMode} className="auth-link-button">
          Create an account
        </button>
      </p>
    </>
  )
}
