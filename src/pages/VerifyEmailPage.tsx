import { Link, useSearchParams } from 'react-router-dom'
import { Brand } from '../components/ui/Brand'
import { VerifyEmailStep } from '../components/auth/steps/VerifyEmailStep'
import { ThemeToggle } from '../components/ui/ThemeToggle'
export function VerifyEmailPage() { const [params] = useSearchParams(); const email = params.get('email') ?? ''; return <main className="auth-layout"><header className="auth-header"><Link to="/"><Brand /></Link><span>Your document workspace</span><ThemeToggle /></header><section className="auth-card"><VerifyEmailStep email={email} onBackToLogin={() => { window.location.href = '/login' }} /></section><footer className="auth-footer">A little less paperwork. A little more progress.</footer></main> }
