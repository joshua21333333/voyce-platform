'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useState, Suspense } from 'react'

function ReviseForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const contentItemId = searchParams.get('id') ?? ''
  const [notes, setNotes] = useState('')
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await fetch('/api/revisions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contentItemId, notes }),
    })
    setSubmitted(true)
    setTimeout(() => router.push('/drafts'), 2500)
  }

  if (submitted) {
    return (
      <p style={{ color: '#34d399', fontSize: '14px', textAlign: 'center' }}>
        ✓ Revision request sent. Revised draft arrives within 24 hours.
      </p>
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      <label style={{ display: 'block', fontSize: '11px', color: '#5a6278', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>
        What needs to change?
      </label>
      <textarea
        value={notes}
        onChange={e => setNotes(e.target.value)}
        required
        rows={5}
        placeholder={`Be specific — "the opener is too formal" or "the third paragraph misrepresents my position on X" is more useful than "it doesn't sound like me".`}
        style={{
          width: '100%', padding: '12px 14px', background: '#0d0e12',
          border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px',
          color: '#f0f2f8', fontSize: '14px', resize: 'vertical', outline: 'none',
          fontFamily: 'inherit', lineHeight: 1.6, marginBottom: '16px',
        }}
      />
      <button
        type="submit"
        style={{
          padding: '10px 24px', background: '#4b9eff', color: '#0d0e12',
          border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 600,
          cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        Send revision notes
      </button>
    </form>
  )
}

export default function RevisePage() {
  return (
    <div className="bg-grid" style={{ minHeight: '100vh', backgroundColor: '#0a0b0f', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '520px' }}>
        <p style={{ fontSize: '20px', fontWeight: 600, letterSpacing: '0.04em', marginBottom: '40px', color: '#f0f2f8' }}>
          Voyce
        </p>
        <h1 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '6px' }}>Request a revision</h1>
        <p style={{ color: '#9ba3b8', fontSize: '13px', marginBottom: '28px' }}>
          Revised draft arrives within 24 hours.
        </p>
        <div style={{ background: '#111318', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '28px' }}>
          <Suspense fallback={<p style={{ color: '#5a6278', fontSize: '13px' }}>Loading…</p>}>
            <ReviseForm />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
