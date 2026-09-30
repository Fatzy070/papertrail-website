import { AuthStory } from './AuthStory'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import type { Variants } from 'framer-motion'
import { Brand } from '../ui/Brand'
import { LoginStep } from './steps/LoginStep'
import { RegisterStep } from './steps/RegisterStep'
import { VerifyEmailStep } from './steps/VerifyEmailStep'
import { ForgotPasswordStep } from './steps/ForgotPasswordStep'
import { ResetPasswordStep } from './steps/ResetPasswordStep'
import { ThemeToggle } from '../ui/ThemeToggle'

export type AuthStepType = 'login' | 'register' | 'verify-email' | 'forgot-password' | 'reset-password'

export function AuthShell() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const stateEmail = location.state?.email || sessionStorage.getItem('papertrail_pending_verification_email') || ''
  const [email, setEmailState] = useState(stateEmail)

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
      prev.delete('email')
      return prev
    }, { replace: true, state: { email } })
  }

  const handleEmailChange = (newEmail: string) => {
    setEmailState(newEmail)
    if (newEmail) {
      sessionStorage.setItem('papertrail_pending_verification_email', newEmail)
    } else {
      sessionStorage.removeItem('papertrail_pending_verification_email')
    }
    setSearchParams((prev) => {
      prev.set('step', step)
      prev.delete('email')
      return prev
    }, { replace: true, state: { email: newEmail } })
  }

  const shouldReduceMotion = useReducedMotion()
  
  const stepVariants: Variants = {
    enter: { opacity: 0, y: shouldReduceMotion ? 0 : 10 },
    center: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: shouldReduceMotion ? 0 : -10 }
  }

  const layoutVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        duration: 0.3
      }
    }
  }

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 15 },
    show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } }
  }

  return (
    <motion.main 
      className="auth-layout"
      variants={layoutVariants}
      initial="hidden"
      animate="show"
    >
      <motion.header variants={itemVariants} className="auth-header">
        <Link to="/">
          <Brand />
        </Link>
        <span>Your document workspace</span>
        <ThemeToggle />
      </motion.header>
      
      <motion.div variants={itemVariants} className="contents">
        <AuthStory />
      </motion.div>

      <motion.section variants={itemVariants} className="auth-card overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25, ease: 'easeInOut' }}
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
      </motion.section>
      
      <motion.footer variants={itemVariants} className="auth-footer">
        A little less paperwork. A little more progress.
      </motion.footer>
    </motion.main>
  )
}
