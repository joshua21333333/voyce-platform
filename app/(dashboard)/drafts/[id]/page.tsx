import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { getContent } from '@/lib/r2'
import Link from 'next/link'

function formatContentType(type: string): string {
  return type.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export default async function DraftDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ held?: string; already_actioned?: string }>
}) {
  const session = await auth()
  if (!session?.user?.email) redirect('/login')

  const { id } = await params
  const { held, already_actioned } = await searchParams

  const client = await prisma.client.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  })
  if (!client) redirect('/login')

  const item = await prisma.contentItem.findUnique({
    where: { id, clientId: client.id },
    select: {
      id: true,
      contentType: true,
      status: true,
      storageKey: true,
      contentPreview: true,
      platformTarget: true,
      holdReason: true,
      confidenceScore: true,
      createdAt: true,
      deliveredAt: true,
      approvedAt: true,
    },
  })

  if (!item) notFound()

  // Fetch full content from R2
  let fullContent = item.contentPreview ?? ''
  if (item.storageKey) {
    try {
      fullContent = await getContent(item.storageKey)
    } catch {
      // R2 not configured in dev — fall back to preview
    }
  }

  const isDiscovery = fullContent.includes('## Direct & Opinionated') ||
    fullContent.includes('## Narrative & Story-driven') ||
    fullContent.includes('## Educational & Structured')

  const canAct = item.status === 'DELIVERED' || item.status === 'HOLD_RECOMMENDED'

  return (
    <div style={{ maxWidth: '680px' }}>
      {/* Back */}
      <Link
        href="/drafts"
        style={{ color: '#888', fontSize: '13px', textDecoration: 'none', display: 'block', marginBottom: '32px' }}
      >
        ← Back to drafts
      </Link>

      {/* Banners */}
      {held === 'true' && (
        <div style={{ background: '#F5F5F5', border: '1px solid #E0E0E0', borderRadius: '4px', padding: '12px 16px', marginBottom: '20px', fontSize: '13px', color: '#616161' }}>
          This draft is on hold. You can still approve it at any time from this page.
        </div>
      )}
      {already_actioned === 'true' && (
        <div style={{ background: '#E8F5E9', border: '1px solid #C8E6C9', borderRadius: '4px', padding: '12px 16px', marginBottom: '20px', fontSize: '13px', color: '#2E7D32' }}>
          This draft has already been actioned.
        </div>
      )}
      {item.status === 'HOLD_RECOMMENDED' && item.holdReason && (
        <div style={{ background: '#FBE9E7', border: '1px solid #FFCCBC', borderRadius: '6px', padding: '16px 20px', marginBottom: '24px' }}>
          <p style={{ fontSize: '11px', color: '#C8A95A', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
            Voyce recommends holding this draft
          </p>
          <p style={{ fontSize: '14px', color: '#BF360C' }}>{item.holdReason}</p>
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <h1 style={{ fontSize: '30px', margin: 0 }}>
            {formatContentType(item.contentType)}
          </h1>
          {item.platformTarget && (
            <span style={{ fontSize: '12px', color: '#888', background: '#F0EBE3', padding: '3px 10px', borderRadius: '3px' }}>
              {item.platformTarget}
            </span>
          )}
        </div>
        <p style={{ color: '#888', fontSize: '12px' }}>
          Created {new Date(item.createdAt).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          {item.confidenceScore && ` · Confidence ${Math.round(item.confidenceScore)}%`}
        </p>
      </div>

      {/* Draft content */}
      <div
        style={{
          background: '#fff',
          border: '1px solid #E4DDD2',
          borderRadius: '6px',
          padding: '28px',
          marginBottom: '28px',
        }}
      >
        {isDiscovery ? (
          <div>
            <p style={{ fontSize: '11px', color: '#C8A95A', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '20px' }}>
              Voice Discovery — choose the closest style
            </p>
            <div style={{ whiteSpace: 'pre-wrap', fontSize: '14px', lineHeight: 1.8, color: '#1a1a1a' }}>
              {fullContent}
            </div>
          </div>
        ) : (
          <div style={{ whiteSpace: 'pre-wrap', fontSize: '14px', lineHeight: 1.8, color: '#1a1a1a' }}>
            {fullContent}
          </div>
        )}
      </div>

      {/* Action buttons — only show for actionable statuses */}
      {canAct && (
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <form action={`/api/approvals/${generateTokenUrl(item.id, 'approve')}`} method="GET">
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
              Approve & publish
            </button>
          </form>
          <a
            href={`/revise?id=${item.id}`}
            style={{
              padding: '12px 24px',
              background: '#fff',
              color: '#1a1a1a',
              border: '1px solid #1a1a1a',
              borderRadius: '4px',
              fontFamily: "'DM Mono', monospace",
              fontSize: '13px',
              fontWeight: 500,
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            Request revision
          </a>
          {item.status !== 'ON_HOLD' && (
            <a
              href={`/api/approvals/${generateTokenUrl(item.id, 'hold')}`}
              style={{
                padding: '12px 24px',
                background: '#fff',
                color: '#888',
                border: '1px solid #E4DDD2',
                borderRadius: '4px',
                fontFamily: "'DM Mono', monospace",
                fontSize: '13px',
                textDecoration: 'none',
                display: 'inline-block',
              }}
            >
              Hold for now
            </a>
          )}
        </div>
      )}

      {item.status === 'APPROVED' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#2E7D32', fontSize: '13px' }}>
          <span>✓</span>
          <span>Approved {item.approvedAt ? new Date(item.approvedAt).toLocaleDateString() : ''}</span>
        </div>
      )}
    </div>
  )
}

// In the real app this would use the tokens library server-side.
// For the dashboard we redirect to the API route which handles it.
function generateTokenUrl(contentItemId: string, action: string): string {
  return `${contentItemId}?action=${action}&source=dashboard`
}
