import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Brand } from '../ui/Brand'
import { LoginStep } from './steps/LoginStep'
import { RegisterStep } from './steps/RegisterStep'
import { VerifyEmailStep } from './steps/VerifyEmailStep'
import { ForgotPasswordStep } from './steps/ForgotPasswordStep'
import { ResetPasswordStep } from './steps/ResetPasswordStep'
import { ThemeToggle } from '../ui/ThemeToggle'

export type AuthStepType = 'login' | 'register' | 'verify-email' | 'forgot-password' | 'reset-password'

const variants = {
  enter: { opacity: 0, y: 10 },
  center: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 }
}

export function AuthShell() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const urlEmail = searchParams.get('email')
  const [email, setEmailState] = useState(urlEmail || '')

  const [step, setStepState] = useState<AuthStepType>(() => {
    const stepParam = searchParams.get('step') as AuthStepType
    if (stepParam && ['login', 'register', 'verify-email', 'forgot-password', 'reset-password'].includes(stepParam)) {
      return stepParam
    }
    const saved = localStorage.getItem('pdf-editor-auth-flow') as AuthStepType
    if (saved && ['login', 'register', 'verify-email', 'forgot-password'].includes(saved)) {
      return saved
    }
    return 'forgot-password'
  })

  const setStep = (newStep: AuthStepType) => {
    setStepState(newStep)
    if (['forgot-password', 'reset-password'].includes(newStep)) {
      localStorage.setItem('pdf-editor-auth-flow', newStep)
    } else {
      localStorage.removeItem('pdf-editor-auth-flow')
    }
    
    setSearchParams((prev) => {
      prev.set('step', newStep)
      if (email) {
        prev.set('email', email)
      } else {
        prev.delete('email')
      }
      return prev
    }, { replace: true })
  }

  const handleEmailChange = (newEmail: string) => {
    setEmailState(newEmail)
    setSearchParams((prev) => {
      if (newEmail) prev.set('email', newEmail)
      else prev.delete('email')
      return prev
    }, { replace: true })
  }

  return (
    <main className="auth-layout">
      <header className="auth-header">
        <Link to="/">
          <Brand />
        </Link>
        <span>Your document workspace</span>
        <ThemeToggle />
      </header>
      <section className="auth-card overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.2 }}
          >
            {step === 'login' && (
              <LoginStep
                onSwitchMode={() => setStep('register')}
                onForgotPassword={() => setStep('forgot-password')}
                onNeedsVerification={(emailAddress) => {
                  handleEmailChange(emailAddress)
                  setStep('verify-email')
                }}
              />
            )}
            {step === 'register' && (
              <RegisterStep
                onSwitchMode={() => setStep('login')}
                onSuccess={(emailAddress) => {
                  handleEmailChange(emailAddress)
                  setStep('verify-email')
                }}
              />
            )}
            {step === 'verify-email' && (
              <VerifyEmailStep
                email={email}
                onBackToLogin={() => navigate('/login')}
              />
            )}
            {step === 'forgot-password' && (
              <ForgotPasswordStep
                onBackToLogin={() => navigate('/login')}
                onCodeSent={(emailAddress) => {
                  handleEmailChange(emailAddress)
                  setStep('reset-password')
                }}
              />
            )}
            {step === 'reset-password' && (
              <ResetPasswordStep
                email={email}
                onBackToLogin={() => navigate('/login')}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </section>
      <footer className="auth-footer">
        A little less paperwork. A little more progress.
      </footer>
    </main>
  )
}
