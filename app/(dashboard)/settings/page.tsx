import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { bufferConfigured } from '@/lib/buffer'

const NOTICES: Record<string, { text: string; ok: boolean }> = {
  buffer: { text: 'Buffer connected — approved content can now publish automatically.', ok: true },
  buffer_not_configured: { text: 'Buffer isn’t configured on this deployment yet (missing app credentials).', ok: false },
  buffer_bad_state: { text: 'Buffer connection failed a security check. Please try again.', ok: false },
  buffer_state_mismatch: { text: 'Buffer connection failed a security check. Please try again.', ok: false },
  buffer_no_profiles: { text: 'No publishing channels were found on that Buffer account.', ok: false },
  buffer_exchange_failed: { text: 'Could not complete the Buffer connection. Please try again.', ok: false },
  buffer_missing_code: { text: 'Buffer did not return an authorization code. Please try again.', ok: false },
  buffer_disconnected: { text: 'Buffer disconnected.', ok: true },
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; disconnected?: string; error?: string }>
}) {
  const session = await auth()
  if (!session?.user?.email) redirect('/login')

  const { connected, disconnected, error } = await searchParams

  const client = await prisma.client.findUnique({
    where: { email: session.user.email },
    select: { bufferProfileId: true, plan: true },
  })

  const bufferConnected = Boolean(client?.bufferProfileId)
  const configured = bufferConfigured()

  const noticeKey = error ?? (connected ? 'buffer' : disconnected ? 'buffer_disconnected' : null)
  const notice = noticeKey ? NOTICES[noticeKey] : null

  return (
    <div>
      <h1 style={{ fontSize: '30px', fontWeight: 600, marginBottom: '4px' }}>Settings</h1>
      <p style={{ color: '#9ba3b8', fontSize: '13px', marginBottom: '32px' }}>
        Publishing connections, workflow configuration, delivery preferences.
      </p>

      {notice && (
        <div
          style={{
            background: notice.ok ? 'rgba(52,211,153,0.08)' : 'rgba(248,113,113,0.08)',
            border: `1px solid ${notice.ok ? 'rgba(52,211,153,0.2)' : 'rgba(248,113,113,0.2)'}`,
            borderRadius: '8px', padding: '12px 16px', marginBottom: '20px',
            fontSize: '13px', color: notice.ok ? '#34d399' : '#f87171',
          }}
        >
          {notice.text}
        </div>
      )}

      {/* Publishing connections */}
      <div style={{ background: '#111318', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '28px', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>Publishing</h2>
        <p style={{ color: '#9ba3b8', fontSize: '13px', marginBottom: '20px' }}>
          Connect a channel so approved content publishes automatically. Without a connection, approved
          content waits for you to publish it manually.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: '#0d0e12', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px' }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '2px' }}>Buffer</div>
            <div style={{ fontSize: '12px', color: bufferConnected ? '#34d399' : '#5a6278' }}>
              {bufferConnected ? 'Connected' : configured ? 'Not connected' : 'Not available on this deployment'}
            </div>
          </div>
          {bufferConnected ? (
            <form action="/api/integrations/buffer/disconnect" method="post">
              <button
                type="submit"
                style={{ padding: '8px 18px', background: 'transparent', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Disconnect
              </button>
            </form>
          ) : (
            <a
              href="/api/integrations/buffer/connect"
              aria-disabled={!configured}
              style={{
                padding: '8px 18px', background: configured ? '#4b9eff' : 'rgba(255,255,255,0.06)',
                color: configured ? '#0d0e12' : '#5a6278', borderRadius: '6px', fontSize: '12px',
                fontWeight: 600, textDecoration: 'none', pointerEvents: configured ? 'auto' : 'none',
              }}
            >
              Connect
            </a>
          )}
        </div>
      </div>

      {/* Autonomy levels teaser */}
      <div style={{ background: '#111318', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>Autonomy Level</h2>
            <p style={{ color: '#9ba3b8', fontSize: '13px' }}>Control how much Voyce publishes without your review.</p>
          </div>
          <span style={{ fontSize: '11px', color: '#4b9eff', background: 'rgba(75,158,255,0.1)', padding: '3px 10px', borderRadius: '4px' }}>Sprint 3</span>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {['Manual review', 'Confidence gate', 'Fully autonomous'].map((level, i) => (
            <div key={level} style={{ flex: 1, padding: '12px', background: i === 0 ? 'rgba(75,158,255,0.08)' : '#0d0e12', border: `1px solid ${i === 0 ? 'rgba(75,158,255,0.3)' : 'rgba(255,255,255,0.06)'}`, borderRadius: '6px' }}>
              <p style={{ fontSize: '12px', fontWeight: 500, color: i === 0 ? '#4b9eff' : '#9ba3b8', marginBottom: '4px' }}>Level {i + 1}</p>
              <p style={{ fontSize: '11px', color: '#5a6278' }}>{level}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
