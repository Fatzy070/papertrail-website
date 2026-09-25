import { useState, type FormEvent } from 'react'
import { ArrowRight, Eye, EyeOff, LoaderCircle } from 'lucide-react'
import { useRegister } from '../../../hooks/use-auth'

export function RegisterStep({ 
  onSwitchMode, 
  onSuccess 
}: { 
  onSwitchMode: () => void,
  onSuccess: (email: string) => void 
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)
  const register = useRegister()

  async function submit(event: FormEvent) {
    event.preventDefault()
    try {
      await register.mutateAsync({ name, email, password })
      onSuccess(email)
    } catch {
      // Error handled by hook
    }
  }

  return (
    <>
      <div className="auth-symbol">
        <ArrowRight size={22} />
      </div>
      <h1>Make room for better work.</h1>
      <p className="muted">Create an account to edit and organize your PDFs.</p>
      
      <form onSubmit={(e) => void submit(e)} className="auth-form">
        <label className="field-label">
          Full name
          <input
            autoComplete="name"
            placeholder="Alex Morgan"
            className="text-input"
            required
            minLength={2}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        
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
          <span>Password</span>
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
        
        {register.error && (
          <p role="alert" className="error-message">
            {register.error.message}
          </p>
        )}
        
        <button
          className="primary-button auth-submit"
          disabled={register.isPending}
        >
          {register.isPending ? (
            <LoaderCircle size={16} className="animate-spin" />
          ) : null}
          Create account
          <ArrowRight size={16} />
        </button>
      </form>
      
      <p className="auth-switch">
        Already have an account?{' '}
        <button type="button" onClick={onSwitchMode} className="auth-link-button">
          Sign in
        </button>
      </p>
    </>
  )
}
