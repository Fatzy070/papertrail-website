import { motion, useReducedMotion } from 'framer-motion'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AuthStory } from '../components/auth/AuthStory'
import { VerifyEmailStep } from '../components/auth/steps/VerifyEmailStep'
import { Brand } from '../components/ui/Brand'
import { ThemeToggle } from '../components/ui/ThemeToggle'

export function VerifyEmailPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const shouldReduceMotion = useReducedMotion()
  const email = location.state?.email || sessionStorage.getItem('papertrail_pending_verification_email') || ''
  const entranceOffset = shouldReduceMotion ? 0 : 14

  return (
    <motion.main
      className="auth-layout"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: shouldReduceMotion ? 0 : 0.2 }}
    >
      <motion.header
        className="auth-header"
        initial={{ opacity: 0, y: -entranceOffset }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.28, ease: 'easeOut' }}
      >
        <Link to="/"><Brand /></Link>
        <span>Your document workspace</span>
        <ThemeToggle />
      </motion.header>

      <motion.div
        initial={{ opacity: 0, x: -entranceOffset }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.36, delay: 0.06, ease: 'easeOut' }}
      >
        <AuthStory />
      </motion.div>

      <motion.section
        className="auth-card"
        initial={{ opacity: 0, y: entranceOffset, scale: shouldReduceMotion ? 1 : 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.34, delay: 0.1, ease: 'easeOut' }}
      >
        <VerifyEmailStep email={email} onBackToLogin={() => navigate('/login')} />
      </motion.section>

      <motion.footer
        className="auth-footer"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.25, delay: 0.18 }}
      >
        A little less paperwork. A little more progress.
      </motion.footer>
    </motion.main>
  )
}
