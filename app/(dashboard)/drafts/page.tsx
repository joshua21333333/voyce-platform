import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import Link from 'next/link'
import { redirect } from 'next/navigation'

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  DRAFT:              { label: 'Draft',             color: '#9ba3b8', bg: 'rgba(155,163,184,0.08)', dot: '#5a6278' },
  DELIVERED:          { label: 'Awaiting review',   color: '#4b9eff', bg: 'rgba(75,158,255,0.08)',  dot: '#4b9eff' },
  APPROVED:           { label: 'Approved',          color: '#34d399', bg: 'rgba(52,211,153,0.08)',  dot: '#34d399' },
  REVISION_REQUESTED: { label: 'Revision requested',color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  dot: '#f59e0b' },
  REVISING:           { label: 'Revising',          color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  dot: '#f59e0b' },
  CHANGE_ORDER_REQUIRED: { label: 'Change order',   color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  dot: '#f59e0b' },
  HOLD_RECOMMENDED:   { label: 'Hold recommended',  color: '#f87171', bg: 'rgba(248,113,113,0.08)', dot: '#f87171' },
  ON_HOLD:            { label: 'On hold',           color: '#6b7280', bg: 'rgba(107,114,128,0.08)', dot: '#6b7280' },
  PUBLISHING:         { label: 'Publishing',        color: '#4b9eff', bg: 'rgba(75,158,255,0.08)',  dot: '#4b9eff' },
  PUBLISH_FAILED:     { label: 'Publish failed',    color: '#f87171', bg: 'rgba(248,113,113,0.08)', dot: '#f87171' },
  PUBLISHED:          { label: 'Published',         color: '#34d399', bg: 'rgba(52,211,153,0.08)',  dot: '#34d399' },
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_CONFIG[status] ?? STATUS_CONFIG['DRAFT']
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '3px 10px',
        borderRadius: '20px',
        fontSize: '11px',
        fontWeight: 500,
        letterSpacing: '0.04em',
        color: s.color,
        background: s.bg,
      }}
    >
      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
      {s.label}
    </span>
  )
}

function formatType(type: string) {
  return type.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export default async function DraftsPage() {
  const session = await auth()
  if (!session?.user?.email) redirect('/login')

  const client = await prisma.client.findUnique({
    where: { email: session.user.email },
    select: { id: true, name: true, contentActionsUsed: true, contentActionsLimit: true },
  })

  if (!client) {
    return (
      <div>
        <h1 style={{ fontSize: '28px', marginBottom: '8px' }}>Drafts</h1>
        <p style={{ color: '#9ba3b8' }}>No client account found for this email. Complete onboarding first.</p>
      </div>
    )
  }

  const items = await prisma.contentItem.findMany({
    where: { clientId: client.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { id: true, contentType: true, status: true, contentPreview: true, platformTarget: true, createdAt: true, holdReason: true },
  })

  const usagePct = client.contentActionsLimit > 0
    ? Math.round((client.contentActionsUsed / client.contentActionsLimit) * 100)
    : 0

  const pending = items.filter(i => i.status === 'DELIVERED' || i.status === 'HOLD_RECOMMENDED').length

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '40px' }}>
        <div>
          <h1 style={{ fontSize: '30px', fontWeight: 600, marginBottom: '4px' }}>Drafts</h1>
          <p style={{ color: '#9ba3b8', fontSize: '13px' }}>
            {pending > 0 ? `${pending} draft${pending > 1 ? 's' : ''} waiting for your review` : 'All caught up.'}
          </p>
        </div>

        {/* Content Actions meter */}
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: '11px', color: '#5a6278', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '6px' }}>
            Content Actions
          </p>
          <p style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px' }}>
            {client.contentActionsUsed}
            <span style={{ color: '#5a6278', fontWeight: 400 }}> / {client.contentActionsLimit}</span>
          </p>
          <div style={{ width: '128px', height: '3px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px' }}>
            <div
              style={{
                width: `${Math.min(usagePct, 100)}%`,
                height: '100%',
                background: usagePct >= 80 ? '#f59e0b' : '#4b9eff',
                borderRadius: '2px',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        </div>
      </div>

      {/* Empty state */}
      {items.length === 0 ? (
        <div
          style={{
            background: '#111318',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '12px',
            padding: '80px 40px',
            textAlign: 'center',
          }}
        >
          {/* Agent network hint */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '24px' }}>
            {['Orchestrator', 'Content Writer', 'Eval'].map((label) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'rgba(75,158,255,0.4)', border: '1px solid rgba(75,158,255,0.6)' }} />
                <span style={{ fontSize: '11px', color: '#5a6278' }}>{label}</span>
              </div>
            ))}
          </div>
          <h2 style={{ fontSize: '20px', marginBottom: '8px', color: '#f0f2f8' }}>No drafts yet</h2>
          <p style={{ color: '#5a6278', fontSize: '13px' }}>
            Your first draft will arrive once your Brand Intelligence Layer is complete.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {items.map((item, i) => (
            <Link
              key={item.id}
              href={`/drafts/${item.id}`}
              style={{ display: 'block', textDecoration: 'none' }}
            >
              <div
                style={{
                  background: i === 0 ? '#111318' : 'transparent',
                  border: `1px solid ${i === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)'}`,
                  borderRadius: '8px',
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '20px',
                  cursor: 'pointer',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '12px', color: '#4b9eff', fontWeight: 500 }}>
                      {formatType(item.contentType)}
                    </span>
                    {item.platformTarget && (
                      <span style={{ fontSize: '11px', color: '#5a6278' }}>· {item.platformTarget}</span>
                    )}
                  </div>
                  <p style={{ fontSize: '13px', color: '#9ba3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '560px' }}>
                    {item.contentPreview ?? 'Draft queued…'}
                  </p>
                  {item.holdReason && (
                    <p style={{ fontSize: '11px', color: '#f87171', marginTop: '6px' }}>
                      Hold: {item.holdReason}
                    </p>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', flexShrink: 0 }}>
                  <StatusBadge status={item.status} />
                  <span style={{ fontSize: '11px', color: '#5a6278' }}>
                    {new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
