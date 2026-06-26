'use client'

import { useState } from 'react'
import { PRICING_TIERS } from '@/config/pricing'

type PlanId = 'STARTER' | 'GROWTH' | 'PRO'

interface FormState {
  name: string
  email: string
  companyName: string
  toneDescription: string
  writingStyle: string
  prohibitedPhrases: string
  primaryCustomer: string
  biggestFrustration: string
  pillars: string
  opinions: string
  sample1: string
  sample2: string
  sample3: string
  activePlatforms: string
  publishingCadence: string
  qualityFloor: string
  plan: PlanId
}

const EMPTY: FormState = {
  name: '', email: '', companyName: '', toneDescription: '', writingStyle: '',
  prohibitedPhrases: '', primaryCustomer: '', biggestFrustration: '', pillars: '',
  opinions: '', sample1: '', sample2: '', sample3: '', activePlatforms: '',
  publishingCadence: '', qualityFloor: '', plan: 'GROWTH',
}

const label: React.CSSProperties = {
  display: 'block', fontSize: '11px', color: '#9ba3b8', letterSpacing: '0.06em',
  textTransform: 'uppercase', marginBottom: '8px',
}
const input: React.CSSProperties = {
  width: '100%', padding: '11px 13px', background: '#0d0e12',
  border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px',
  color: '#f0f2f8', fontSize: '14px', outline: 'none', fontFamily: 'inherit',
  marginBottom: '20px', lineHeight: 1.6,
}

export default function OnboardingPage() {
  const [form, setForm] = useState<FormState>(EMPTY)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = (await res.json()) as { checkoutUrl?: string | null; error?: string; warning?: string }
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong. Please check your answers.')
        setSubmitting(false)
        return
      }
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl
        return
      }
      setDone(true)
      setSubmitting(false)
    } catch {
      setError('Network error — please try again.')
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div style={wrap}>
        <div style={{ maxWidth: '480px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '12px' }}>Onboarding saved</h1>
          <p style={{ color: '#9ba3b8', fontSize: '14px', lineHeight: 1.7 }}>
            We&apos;ve saved your Brand Intelligence answers. Payment isn&apos;t set up yet, so we&apos;ll
            follow up to activate your account.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={wrap}>
      <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: '640px' }}>
        <p style={{ color: '#C8A95A', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '12px' }}>
          Voyce — Onboarding
        </p>
        <h1 style={{ fontSize: '28px', fontWeight: 600, marginBottom: '8px' }}>Build your Brand Intelligence Layer</h1>
        <p style={{ color: '#9ba3b8', fontSize: '14px', lineHeight: 1.7, marginBottom: '36px' }}>
          This is the foundation every agent loads before writing. The more specific you are — especially
          your writing samples — the closer your drafts will sound to you.
        </p>

        <Section title="About you">
          <Field label="Your name"><input style={input} value={form.name} onChange={set('name')} required /></Field>
          <Field label="Email"><input style={input} type="email" value={form.email} onChange={set('email')} required /></Field>
          <Field label="Company"><input style={input} value={form.companyName} onChange={set('companyName')} required /></Field>
        </Section>

        <Section title="Voice">
          <Field label="Three words that describe your tone"><input style={input} value={form.toneDescription} onChange={set('toneDescription')} required /></Field>
          <Field label="How do you talk when you're most yourself?"><textarea style={{ ...input, minHeight: '80px', resize: 'vertical' }} value={form.writingStyle} onChange={set('writingStyle')} required /></Field>
          <Field label="Phrases you would never use"><input style={input} value={form.prohibitedPhrases} onChange={set('prohibitedPhrases')} placeholder="e.g. 'in today's world', 'game-changer'" /></Field>
        </Section>

        <Section title="Audience">
          <Field label="Your primary customer"><input style={input} value={form.primaryCustomer} onChange={set('primaryCustomer')} required /></Field>
          <Field label="Their biggest daily frustration"><textarea style={{ ...input, minHeight: '70px', resize: 'vertical' }} value={form.biggestFrustration} onChange={set('biggestFrustration')} required /></Field>
        </Section>

        <Section title="Strategy">
          <Field label="Your 3–4 content pillars"><textarea style={{ ...input, minHeight: '80px', resize: 'vertical' }} value={form.pillars} onChange={set('pillars')} required /></Field>
          <Field label="Opinions most people in your space would push back on"><textarea style={{ ...input, minHeight: '70px', resize: 'vertical' }} value={form.opinions} onChange={set('opinions')} /></Field>
        </Section>

        <Section title="Writing samples">
          <Field label="Sample 1 — a real post/newsletter/article (200+ words)"><textarea style={{ ...input, minHeight: '140px', resize: 'vertical' }} value={form.sample1} onChange={set('sample1')} required /></Field>
          <Field label="Sample 2 (optional)"><textarea style={{ ...input, minHeight: '100px', resize: 'vertical' }} value={form.sample2} onChange={set('sample2')} /></Field>
          <Field label="Sample 3 (optional)"><textarea style={{ ...input, minHeight: '100px', resize: 'vertical' }} value={form.sample3} onChange={set('sample3')} /></Field>
        </Section>

        <Section title="Publishing">
          <Field label="Platforms you publish on"><input style={input} value={form.activePlatforms} onChange={set('activePlatforms')} placeholder="LinkedIn, Newsletter, X…" required /></Field>
          <Field label="Publishing cadence"><input style={input} value={form.publishingCadence} onChange={set('publishingCadence')} placeholder="e.g. 2 LinkedIn posts + 1 newsletter / week" required /></Field>
          <Field label="What does excellent content look like to you? (optional)"><textarea style={{ ...input, minHeight: '70px', resize: 'vertical' }} value={form.qualityFloor} onChange={set('qualityFloor')} /></Field>
        </Section>

        <Section title="Plan">
          <div style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
            {(['STARTER', 'GROWTH', 'PRO'] as PlanId[]).map((p) => {
              const tier = PRICING_TIERS[p]
              const selected = form.plan === p
              return (
                <button
                  type="button"
                  key={p}
                  onClick={() => setForm((f) => ({ ...f, plan: p }))}
                  style={{
                    flex: 1, padding: '14px', textAlign: 'left', cursor: 'pointer',
                    background: selected ? 'rgba(75,158,255,0.08)' : '#0d0e12',
                    border: `1px solid ${selected ? 'rgba(75,158,255,0.4)' : 'rgba(255,255,255,0.08)'}`,
                    borderRadius: '8px', color: '#f0f2f8', fontFamily: 'inherit',
                  }}
                >
                  <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '2px' }}>{tier.name}</div>
                  <div style={{ fontSize: '12px', color: '#9ba3b8' }}>${tier.price}/mo · {tier.contentActions} actions</div>
                </button>
              )
            })}
          </div>
        </Section>

        {error && (
          <p style={{ color: '#f87171', fontSize: '13px', marginBottom: '16px' }}>{error}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          style={{
            padding: '13px 28px', background: '#4b9eff', color: '#0d0e12', border: 'none',
            borderRadius: '6px', fontSize: '14px', fontWeight: 600, cursor: submitting ? 'default' : 'pointer',
            fontFamily: 'inherit', opacity: submitting ? 0.6 : 1, marginTop: '8px',
          }}
        >
          {submitting ? 'Setting up…' : 'Continue to payment'}
        </button>
      </form>
    </div>
  )
}

const wrap: React.CSSProperties = {
  minHeight: '100vh', backgroundColor: '#0a0b0f', color: '#f0f2f8',
  display: 'flex', justifyContent: 'center', padding: '56px 24px',
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '12px' }}>
      <h2 style={{ fontSize: '13px', color: '#C8A95A', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '16px', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {title}
      </h2>
      {children}
    </div>
  )
}

function Field({ label: text, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={label}>{text}</label>
      {children}
    </div>
  )
}
