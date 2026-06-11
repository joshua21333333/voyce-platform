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
    setTimeout(() => router.push('/drafts'), 2000)
  }

  if (submitted) {
    return (
      <p style={{ color: '#2E7D32', fontSize: '14px' }}>
        ✓ Revision request sent. We'll have an updated draft to you within 24 hours.
      </p>
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      <label
        style={{
          display: 'block',
          fontSize: '11px',
          color: '#888',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom: '8px',
        }}
      >
        What needs to change?
      </label>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        required
        rows={6}
        placeholder="Be specific — 'the opener is too formal' or 'the third paragraph misrepresents my position on X' is more useful than 'it doesn't sound like me'."
        style={{
          width: '100%',
          padding: '12px 16px',
          border: '1px solid #E4DDD2',
          borderRadius: '4px',
          fontFamily: "'DM Mono', monospace",
          fontSize: '14px',
          backgroundColor: '#FAF7F2',
          color: '#1a1a1a',
          resize: 'vertical',
          outline: 'none',
          marginBottom: '16px',
        }}
      />
      <button
        type="submit"
        style={{
          padding: '12px 24px',
          background: '#C8A95A',
          color: '#fff',
          border: 'none',
          borderRadius: '4px',
          fontFamily: "'DM Mono', monospace",
          fontSize: '13px',
          fontWeight: 500,
          cursor: 'pointer',
        }}
      >
        Send revision notes
      </button>
    </form>
  )
}

export default function RevisePage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FAF7F2',
        padding: '24px',
      }}
    >
      <div style={{ width: '100%', maxWidth: '520px' }}>
        <p
          style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: '28px',
            fontWeight: 600,
            letterSpacing: '0.05em',
            marginBottom: '40px',
          }}
        >
          Voyce
        </p>
        <h1
          style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: '26px',
            marginBottom: '8px',
          }}
        >
          Request a revision
        </h1>
        <p style={{ color: '#888', fontSize: '13px', marginBottom: '28px' }}>
          Tell us what needs to change. Revised draft arrives within 24 hours.
        </p>
        <div
          style={{
            background: '#fff',
            border: '1px solid #E4DDD2',
            borderRadius: '8px',
            padding: '28px',
          }}
        >
          <Suspense fallback={<p style={{ color: '#888', fontSize: '13px' }}>Loading…</p>}>
            <ReviseForm />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
