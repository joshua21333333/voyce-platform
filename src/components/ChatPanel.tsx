'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export interface ChatMessage {
  id: string
  role: string // "founder" | "orchestrator"
  body: string
  createdAt: string // ISO string (serialised across the server boundary)
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function ChatPanel({ initialMessages }: { initialMessages: ChatMessage[] }) {
  const router = useRouter()
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function send(e: React.FormEvent) {
    e.preventDefault()
    const body = draft.trim()
    if (!body || sending) return

    setSending(true)
    setError(null)

    // Optimistic append — replaced by the server's row on refresh.
    const optimistic: ChatMessage = {
      id: `optimistic-${messages.length}`,
      role: 'founder',
      body,
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimistic])
    setDraft('')

    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      })
      if (!res.ok) throw new Error('Failed to send')
      router.refresh()
    } catch {
      setError('Could not send. Try again.')
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
      setDraft(body)
    } finally {
      setSending(false)
    }
  }

  return (
    <div
      style={{
        background: '#111318',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '12px',
        display: 'flex',
        flexDirection: 'column',
        height: '520px',
      }}
    >
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <p style={{ fontSize: '14px', fontWeight: 600, color: '#f0f2f8' }}>Talk to your agents</p>
        <p style={{ fontSize: '12px', color: '#5a6278', marginTop: '2px' }}>
          Leave feedback or direction — the Orchestrator picks it up on the next run.
        </p>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {messages.length === 0 ? (
          <p style={{ fontSize: '13px', color: '#5a6278', margin: 'auto', textAlign: 'center', maxWidth: '320px' }}>
            No messages yet. Tell Voyce what you want more of — punchier hooks, fewer LinkedIn posts,
            a topic to avoid this week — and it&apos;ll shape the next drafts.
          </p>
        ) : (
          messages.map((m) => {
            const isFounder = m.role === 'founder'
            return (
              <div
                key={m.id}
                style={{
                  alignSelf: isFounder ? 'flex-end' : 'flex-start',
                  maxWidth: '78%',
                }}
              >
                <div
                  style={{
                    background: isFounder ? 'rgba(75,158,255,0.12)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${isFounder ? 'rgba(75,158,255,0.25)' : 'rgba(255,255,255,0.07)'}`,
                    borderRadius: '10px',
                    padding: '10px 14px',
                    fontSize: '13px',
                    lineHeight: 1.6,
                    color: '#e0e4f0',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {m.body}
                </div>
                <p
                  style={{
                    fontSize: '10px',
                    color: '#5a6278',
                    marginTop: '4px',
                    textAlign: isFounder ? 'right' : 'left',
                  }}
                >
                  {isFounder ? 'You' : 'Orchestrator'} · {formatTime(m.createdAt)}
                </p>
              </div>
            )
          })
        )}
      </div>

      {/* Composer */}
      <form onSubmit={send} style={{ padding: '14px 16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        {error && <p style={{ fontSize: '11px', color: '#f87171', marginBottom: '8px' }}>{error}</p>}
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Message your agents…"
            style={{
              flex: 1,
              padding: '10px 14px',
              background: '#0d0e12',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              color: '#f0f2f8',
              fontSize: '13px',
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            style={{
              padding: '10px 18px',
              background: sending || !draft.trim() ? 'rgba(75,158,255,0.4)' : '#4b9eff',
              color: '#0d0e12',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: sending || !draft.trim() ? 'default' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Send
          </button>
        </div>
      </form>
    </div>
  )
}
