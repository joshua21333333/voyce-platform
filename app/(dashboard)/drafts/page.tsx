import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import Link from 'next/link'
import { redirect } from 'next/navigation'

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  DRAFT:              { label: 'Draft',             color: '#757575', bg: '#F5F5F5' },
  DELIVERED:          { label: 'Awaiting review',   color: '#8A6E1E', bg: '#FBF3E2' },
  APPROVED:           { label: 'Approved',          color: '#2E7D32', bg: '#E8F5E9' },
  REVISION_REQUESTED: { label: 'Revision requested',color: '#E65100', bg: '#FFF3E0' },
  REVISING:           { label: 'Revising',          color: '#E65100', bg: '#FFF3E0' },
  HOLD_RECOMMENDED:   { label: 'Hold recommended',  color: '#BF360C', bg: '#FBE9E7' },
  ON_HOLD:            { label: 'On hold',           color: '#616161', bg: '#F5F5F5' },
  PUBLISH_FAILED:     { label: 'Publish failed',    color: '#B71C1C', bg: '#FFEBEE' },
  PUBLISHED:          { label: 'Published',         color: '#1565C0', bg: '#E3F2FD' },
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_LABELS[status] ?? STATUS_LABELS['DRAFT']
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '3px 10px',
        borderRadius: '3px',
        fontSize: '11px',
        fontWeight: 500,
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
        color: s.color,
        backgroundColor: s.bg,
      }}
    >
      {s.label}
    </span>
  )
}

function formatContentType(type: string): string {
  return type.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
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
        <h1 style={{ fontSize: '32px', marginBottom: '8px' }}>Drafts</h1>
        <p style={{ color: '#888' }}>No client account found for this email.</p>
      </div>
    )
  }

  const items = await prisma.contentItem.findMany({
    where: { clientId: client.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      contentType: true,
      status: true,
      contentPreview: true,
      platformTarget: true,
      createdAt: true,
      deliveredAt: true,
      approvedAt: true,
      holdReason: true,
    },
  })

  const usagePct = client.contentActionsLimit > 0
    ? Math.round((client.contentActionsUsed / client.contentActionsLimit) * 100)
    : 0

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '40px' }}>
        <div>
          <h1 style={{ fontSize: '36px', marginBottom: '4px' }}>Drafts</h1>
          <p style={{ color: '#888', fontSize: '13px' }}>Review and approve your content before it publishes.</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: '11px', color: '#888', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '4px' }}>
            Content Actions
          </p>
          <p style={{ fontSize: '16px', fontWeight: 500 }}>
            {client.contentActionsUsed} / {client.contentActionsLimit}
          </p>
          <div style={{ width: '120px', height: '3px', background: '#E4DDD2', borderRadius: '2px', marginTop: '6px' }}>
            <div
              style={{
                width: `${Math.min(usagePct, 100)}%`,
                height: '100%',
                background: usagePct >= 80 ? '#FF9800' : '#C8A95A',
                borderRadius: '2px',
              }}
            />
          </div>
        </div>
      </div>

      {items.length === 0 ? (
        <div
          style={{
            background: '#fff',
            border: '1px solid #E4DDD2',
            borderRadius: '8px',
            padding: '60px 40px',
            textAlign: 'center',
          }}
        >
          <h2 style={{ fontSize: '24px', marginBottom: '8px' }}>No drafts yet</h2>
          <p style={{ color: '#888', fontSize: '13px' }}>
            Your first draft will arrive here once your Brand Intelligence Layer is ready.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/drafts/${item.id}`}
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <div
                style={{
                  background: '#fff',
                  border: '1px solid #E4DDD2',
                  borderRadius: '6px',
                  padding: '20px 24px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '24px',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', color: '#888' }}>
                      {formatContentType(item.contentType)}
                    </span>
                    {item.platformTarget && (
                      <span style={{ fontSize: '11px', color: '#aaa' }}>· {item.platformTarget}</span>
                    )}
                  </div>
                  <p
                    style={{
                      fontSize: '14px',
                      lineHeight: 1.5,
                      color: '#1a1a1a',
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {item.contentPreview ?? 'No preview available.'}
                  </p>
                  {item.holdReason && (
                    <p style={{ fontSize: '12px', color: '#BF360C', marginTop: '8px' }}>
                      Hold reason: {item.holdReason}
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', flexShrink: 0 }}>
                  <StatusBadge status={item.status} />
                  <span style={{ fontSize: '11px', color: '#aaa' }}>
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
