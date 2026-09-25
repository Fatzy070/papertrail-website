import { Link, useNavigate } from 'react-router-dom'
import { Brand } from '../components/ui/Brand'
import { LoginStep } from '../components/auth/steps/LoginStep'
import { RegisterStep } from '../components/auth/steps/RegisterStep'
import { ThemeToggle } from '../components/ui/ThemeToggle'

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const navigate = useNavigate()
  return <main className="auth-layout"><header className="auth-header"><Link to="/"><Brand /></Link><span>Your document workspace</span><ThemeToggle /></header><section className="auth-card">
    {mode === 'login' ? <LoginStep onSwitchMode={() => navigate('/register')} onForgotPassword={() => navigate('/forgot-password')} onNeedsVerification={(email) => navigate(`/verify-email?email=${encodeURIComponent(email)}`)} /> : <RegisterStep onSwitchMode={() => navigate('/login')} onSuccess={(email) => navigate(`/verify-email?email=${encodeURIComponent(email)}`)} />}
  </section><footer className="auth-footer">A little less paperwork. A little more progress.</footer></main>
}
