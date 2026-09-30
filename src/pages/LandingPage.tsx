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
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ToolCatalog } from '../components/tools/ToolCatalog'
import { Brand } from '../components/ui/Brand'
import { ThemeToggle } from '../components/ui/ThemeToggle'

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
        <Hero reducedMotion={reducedMotion} />
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
  return (
    <header className="landing-header">
      <Link to="/" aria-label="Papertrail home">
        <Brand />
      </Link>

      <nav aria-label="Main navigation">
        <a href="#editor">The editor</a>
        <a href="#tools">PDF tools</a>
        <a href="#pricing">Pricing</a>
      </nav>

      <div className="landing-header-actions">
        <ThemeToggle />
        <Link to="/login" className="text-link">Sign in</Link>
        <Link to="/register" className="primary-button">
          Get started <ArrowUpRight size={15} />
        </Link>
      </div>
    </header>
  )
}

function Hero({ reducedMotion }: { reducedMotion: boolean | null }) {
  return (
    <section className="landing-hero">
      <motion.div
        className="hero-copy"
        initial={reducedMotion ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55 }}
      >
        <p className="eyebrow"><span className="live-dot" /> YOUR DOCUMENTS. YOUR WAY.</p>
        <h1>Less paperwork.<br />More <em>possibility.</em></h1>
        <p className="hero-description">
          A considered workspace for your PDFs. Edit text, arrange pages, add your signature,
          and get back to the work that matters.
        </p>
        <div className="hero-actions">
          <Link to="/register" className="primary-button">
            Start editing for free <ArrowRight size={17} />
          </Link>
          <a href="#editor" className="text-link">
            Take a closer look <ArrowUpRight size={16} />
          </a>
        </div>
        <p className="hero-note">Free to edit. Export from ₦500. No subscription required.</p>
      </motion.div>

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
  return (
    <section id="editor" className="landing-section feature-section">
      <SectionIntro
        eyebrow="FROM FIRST EDIT TO FINAL FILE"
        title={<>A PDF is a starting point.<br />Not the end of the story.</>}
        description="One browser workspace for the changes, details, and finishing touches that make a document yours."
      />

      <div className="feature-grid">
        {features.map(({ icon: Icon, title, description }, index) => (
          <article key={title}>
            <span className="feature-index">0{index + 1}</span>
            <Icon size={24} />
            <h3>{title}</h3>
            <p>{description}</p>
          </article>
        ))}
      </div>

      <p className="capability-note">
        PDFs vary. Text editing and font fidelity depend on the source document.
      </p>
    </section>
  )
}

function ToolsSection({ reducedMotion }: { reducedMotion: boolean | null }) {
  return (
    <section id="tools" className="landing-section">
      <div className="section-intro horizontal">
        <div>
          <p className="eyebrow">THE REST OF YOUR TOOLKIT</p>
          <h2>Small tasks. Sorted.</h2>
        </div>
        <p>Keep the whole PDF workflow in one place, from combining files to converting pages.</p>
      </div>

      <motion.div
        initial={reducedMotion ? false : { opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.1 }}
        transition={{ duration: 0.45 }}
      >
        <ToolCatalog />
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
        {plans.map((plan) => <PricingCard key={plan.name} plan={plan} />)}
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
    <div className="section-intro">
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
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
  return (
    <section className="landing-cta">
      <p className="eyebrow">THE NEXT PAGE IS YOURS</p>
      <h2>Make something<br /><em>ready to send.</em></h2>
      <Link className="primary-button" to="/register">
        Open your workspace <ArrowRight size={17} />
      </Link>
    </section>
  )
}

function LandingFooter() {
  return (
    <footer className="landing-footer">
      <Brand />
      <span>Your document workspace.</span>
      <Link to="/login">Sign in</Link>
      <Link to="/support">Help & feedback</Link>
      <a href="#pricing">Pricing</a>
    </footer>
  )
}
