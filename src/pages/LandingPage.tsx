import {
  ArrowRight,
  ArrowUpRight,
  Check,
  FileText,
  Image,
  MousePointer2,
  PenLine,
  StickyNote,
  Type,
  type LucideIcon,
} from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ToolCatalog } from '../components/tools/ToolCatalog'
import { Brand } from '../components/ui/Brand'
import { ThemeToggle } from '../components/ui/ThemeToggle'
import { useCurrentUser } from '../hooks/use-auth'
import '../styles/landing-writer.css'

type Feature = {
  icon: LucideIcon
  title: string
  description: string
}

type Plan = {
  name: string
  price: string
  suffix: string
  intro: string
  features: string[]
  cta: string
  featured?: boolean
}

const features: Feature[] = [
  {
    icon: Type,
    title: 'Change the words.',
    description: 'Edit supported existing PDF text or add new text exactly where you need it.',
  },
  {
    icon: PenLine,
    title: 'Add your touch.',
    description: 'Place images, draw, add notes, create a signature, or apply a watermark.',
  },
  {
    icon: FileText,
    title: 'Put it in order.',
    description: 'Manage pages, find text, undo changes, save your work, and return to your documents.',
  },
]

const plans: Plan[] = [
  {
    name: 'Free',
    price: '₦0',
    suffix: 'to start',
    intro: 'Get your document just right.',
    features: [
      'Experience the core PDF editor',
      'Edit text and add finishing touches',
      'Pay when you need the final export',
    ],
    cta: 'Start editing',
  },
  {
    name: 'One-Time Export',
    price: '₦500',
    suffix: 'per document',
    intro: 'For the PDF you need today.',
    features: [
      'Export your document',
      'Re-export that document for 7 days',
      'No subscription required',
    ],
    cta: 'Get started',
    featured: true,
  },
  {
    name: 'Papertrail Pro',
    price: '₦5,000',
    suffix: 'per month',
    intro: 'For documents that keep coming.',
    features: ['Unlimited exports and higher limits', 'Full version history', 'Premium PDF tools'],
    cta: 'Explore Pro',
  },
]

export function LandingPage() {
  const reducedMotion = useReducedMotion()

  return (
    <div className="landing">
      <div className='fixed  backdrop-blur-md top-0 left-0 right-0 z-50 bg-blur '>
        <LandingHeader />
      </div>

      <main className="pt-10">
        <Hero />
        <EditorFeatures />
        <ToolsSection reducedMotion={reducedMotion} />
        <PricingSection />
        <FinalCallToAction />
      </main>

      <LandingFooter />
    </div>
  )
}

function LandingHeader() {
  const { hasAuthHint } = useCurrentUser()

  return (
    <header className="landing-header">
      <Link to="/" aria-label="Papertrail home">
        <Brand />
      </Link>

      <nav aria-label="Main navigation">
        <a href="#editor">Create & edit</a>
        <a href="#tools">PDF tools</a>
        <a href="#pricing">Pricing</a>
      </nav>

      <div className="landing-header-actions">
        <ThemeToggle />
        {hasAuthHint ? (
          <Link to="/dashboard" className="primary-button">
            Go to dashboard <ArrowUpRight size={15} />
          </Link>
        ) : (
          <>
            <Link to="/login" className="text-link">Sign in</Link>
            <Link to="/register" className="primary-button hide-on-mobile">
              Get started <ArrowUpRight size={15} />
            </Link>
          </>
        )}
      </div>
    </header>
  )
}

function Hero() {
  const { hasAuthHint } = useCurrentUser()

  return (
    <section className="landing-hero">
      <div className="hero-copy">
        <p className="eyebrow"><span className="live-dot" /> YOUR DOCUMENTS. YOUR WAY.</p>
        <h1><span>Less paperwork.</span><span>More <em>possibility.</em></span></h1>
        <p className="hero-description">
          Create PDFs from scratch or edit the ones you already have.
          Write, format, sign, and organize — from first idea to final PDF.
        </p>
        <div className="hero-actions">
          {hasAuthHint ? (
            <Link to="/dashboard" className="primary-button">
              Go to dashboard <ArrowRight size={17} />
            </Link>
          ) : (
            <Link to="/register" className="primary-button">
              Start creating for free <ArrowRight size={17} />
            </Link>
          )}
          <a href="#editor" className="text-link">
            Take a closer look <ArrowUpRight size={16} />
          </a>
        </div>
        <p className="hero-note">Free to edit. Export from ₦500. No subscription required.</p>
      </div>

      <EditorPreview />
    </section>
  )
}

function EditorPreview() {
  return (
    <div className="hero-product" aria-label="Illustration of the Papertrail editor">
      <div className="demo-top">
        <span><FileText size={15} /> Your next big idea.pdf</span>
        <span className="demo-saved"><Check size={12} /> Saved</span>
      </div>
      <div className="demo-body">
        <div className="demo-rail" aria-hidden="true">
          <MousePointer2 />
          <Type />
          <Image />
          <PenLine />
          <StickyNote />
        </div>
        <div className="demo-paper">
          <span className="demo-label">PROJECT / 001</span>
          <h2>A fresh<br />perspective.</h2>
          <div className="demo-rule" />
          <p>Good ideas deserve a clear page.</p>
          <div className="demo-edit">
            Make room for what comes next.<span className="demo-cursor">You</span>
          </div>
          <div className="demo-lines" />
          <div className="demo-signature">Made for the way you work.</div>
          <span className="demo-page-number">PAPERTRAIL — 01</span>
        </div>
      </div>
      <span className="demo-caption">Edit · Organize · Export</span>
    </div>
  )
}

function EditorFeatures() {
  const [workflow, setWorkflow] = useState<'create' | 'edit'>('create')
  const { hasAuthHint } = useCurrentUser()
  return (
    <section id="editor" className="landing-section feature-section">
      <SectionIntro
        eyebrow="CREATE · EDIT · ORGANIZE · EXPORT"
        title={<>A blank page or an existing PDF.<br />Make it yours.</>}
        description="Start from scratch with Papertrail Writer, or open a PDF for the changes and finishing touches it needs."
      />

      <div className="landing-workflow-choices" role="group" aria-label="Document workflow">
        <button type="button" aria-pressed={workflow === 'create'} aria-controls="landing-workflow" onClick={() => setWorkflow('create')}>
          <span>Create PDF</span><small>Start from scratch</small>
        </button>
        <button type="button" aria-pressed={workflow === 'edit'} aria-controls="landing-workflow" onClick={() => setWorkflow('edit')}>
          <span>Edit PDF</span><small>Already have a PDF?</small>
        </button>
      </div>

      <div id="landing-workflow" role="region" aria-label={workflow === 'create' ? 'Create PDF with Papertrail Writer' : 'Edit an existing PDF'}>
      {workflow === 'create' ? <div className="landing-create-showcase">
        <Reveal className="landing-create-copy">
          <p className="eyebrow">PAPERTRAIL WRITER</p>
          <h3>Your words.<br /> A document of your own.</h3>
          <p>Write naturally, format your text, and let it flow across pages. Add page breaks where you need them. Your work saves as you go.</p>
          <Link className="text-link" to={hasAuthHint ? '/dashboard' : '/register'}>Create a PDF <ArrowUpRight size={16} /></Link>
          <p className="landing-create-note">Start with a blank document. Export as PDF when you're ready.</p>
        </Reveal>
        <WriterPreview />
      </div> : <>
      <div className="feature-grid">
        {features.map(({ icon: Icon, title, description }, index) => (
          <Reveal key={title} className="feature-item" delay={index * 0.1}><article>
            <span className="feature-index">0{index + 1}</span>
            <Icon size={24} />
            <h3>{index === 0 ? <motion.span className="feature-selection" initial={{ outlineColor: 'transparent' }} whileInView={{ outlineColor: 'var(--primary)' }} viewport={{ once: true, amount: 1 }} transition={{ delay: 0.3, duration: 0.5 }}>{title}</motion.span> : title}</h3>
            <p>{description}</p>
          </article></Reveal>
        ))}
      </div>

      <p className="capability-note">
        PDFs vary. Text editing and font fidelity depend on the source document.
      </p>
      <Link className="text-link" to={hasAuthHint ? '/documents' : '/register'}>Upload & edit a PDF <ArrowUpRight size={16} /></Link>
      </>}
      </div>
    </section>
  )
}

function WriterPreview() {
  const reducedMotion = useReducedMotion()
  return (
    <div className="landing-writer-preview" aria-hidden="true">
      <div className="landing-writer-top"><span>Our next chapter</span><span><Check size={12} /> Saved</span><span className="landing-writer-export">Export PDF</span></div>
      <div className="landing-writer-toolbar"><span>Paragraph</span><span>Writer Sans</span><span>12 pt</span><b>B</b><i>I</i><u>U</u></div>
      <div className="landing-writer-desk">
        <motion.div className="landing-writer-paper"
          initial={reducedMotion ? false : { opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.5, delay: 0.1, ease: 'easeOut' }}>
          <span className="landing-writer-label">A NEW BEGINNING</span>
          <h4>Every idea starts<br />with a few words.</h4>
          <p>A clear page gives an idea room to grow. Begin with a thought, find the right words, and make them your own.</p>
          <p className="landing-writer-last-line">Here's to what comes next.<motion.span className="landing-writer-caret"
            initial={{ opacity: 0 }} whileInView={reducedMotion ? { opacity: 0 } : { opacity: [0, 1, 0] }}
            viewport={{ once: true }} transition={{ duration: 1, delay: 0.6 }} /></p>
          <span className="landing-writer-page">01</span>
        </motion.div>
      </div>
    </div>
  )
}

function ToolsSection({ reducedMotion }: { reducedMotion: boolean | null }) {
  return (
    <section id="tools" className="landing-section">
      <Reveal className="section-intro horizontal">
        <div>
          <p className="eyebrow">THE REST OF YOUR TOOLKIT</p>
          <h2>Small tasks. Sorted.</h2>
        </div>
        <p>Keep the whole PDF workflow in one place, from combining files to converting pages.</p>
      </Reveal>

      <motion.div
        initial={reducedMotion ? false : { opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.1 }}
        transition={{ duration: 0.45 }}
      >
        <ToolCatalog paperMotion />
      </motion.div>
    </section>
  )
}

function PricingSection() {
  return (
    <section id="pricing" className="landing-section pricing-section">
      <SectionIntro
        eyebrow="PAY FOR WHAT YOU NEED"
        title={<>Your edit is free.<br />Your export, your choice.</>}
        description="One document or an everyday workflow. Choose what fits."
      />

      <div className="pricing-grid">
        {plans.map((plan, index) => <Reveal key={plan.name} delay={index * 0.1}><PricingCard plan={plan} /></Reveal>)}
      </div>

      <p className="pricing-footnote">
        Pro by card renews monthly. Pro by bank transfer gives one month of access without automatic renewal.
      </p>
    </section>
  )
}

function SectionIntro({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string
  title: ReactNode
  description: string
}) {
  return (
    <Reveal className="section-intro">
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      <p>{description}</p>
    </Reveal>
  )
}

function PricingCard({ plan }: { plan: Plan }) {
  return (
    <article className={plan.featured ? 'price-card featured' : 'price-card'}>
      {plan.featured && <span className="price-ribbon">NO COMMITMENT</span>}
      <h3>{plan.name}</h3>
      <p>{plan.intro}</p>
      <div className="price-value">
        {plan.price}<small>{plan.suffix}</small>
      </div>
      <ul>
        {plan.features.map((feature) => (
          <li key={feature}><Check size={16} />{feature}</li>
        ))}
      </ul>
      <Link className={plan.featured ? 'primary-button' : 'toolbar-button bordered'} to="/register">
        {plan.cta}<ArrowUpRight size={15} />
      </Link>
    </article>
  )
}

function FinalCallToAction() {
  const { hasAuthHint } = useCurrentUser()

  return (
    <section className="landing-cta">
      <p className="eyebrow">THE NEXT PAGE IS YOURS</p>
      <h2>Make something<br /><em>ready to send.</em></h2>
      <Link className="primary-button" to={hasAuthHint ? '/dashboard' : '/register'}>
        {hasAuthHint ? 'Go to dashboard' : 'Start creating for free'} <ArrowRight size={17} />
      </Link>
    </section>
  )
}

function LandingFooter() {
  const { hasAuthHint } = useCurrentUser()

  return (
    <footer className="landing-footer">
      <Brand />
      <span>Your document workspace.</span>
      {!hasAuthHint && <Link to="/login">Sign in</Link>}
      <Link to="/support">Help & feedback</Link>
      <a href="#pricing">Pricing</a>
    </footer>
  )
}

function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const reducedMotion = useReducedMotion()
  return <motion.div className={className}
    initial={reducedMotion ? false : { opacity: 0, y: 16 }}
    whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.1 }}
    transition={{ duration: 0.5, delay: reducedMotion ? 0 : delay, ease: 'easeOut' }}>
    {children}
  </motion.div>
}
