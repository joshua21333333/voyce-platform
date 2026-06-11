import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { getContent } from '@/lib/r2'
import Link from 'next/link'

function formatType(type: string) {
  return type.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
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
      id: true, contentType: true, status: true, storageKey: true,
      contentPreview: true, platformTarget: true, holdReason: true,
      confidenceScore: true, createdAt: true, approvedAt: true,
    },
  })
  if (!item) notFound()

  let fullContent = item.contentPreview ?? ''
  if (item.storageKey) {
    try { fullContent = await getContent(item.storageKey) } catch { /* R2 not configured */ }
  }

  const isDiscovery = fullContent.includes('## Direct & Opinionated') ||
    fullContent.includes('## Narrative & Story-driven')

  const canAct = item.status === 'DELIVERED' || item.status === 'HOLD_RECOMMENDED' || item.status === 'DRAFT'

  return (
    <div style={{ maxWidth: '720px' }}>

      {/* Back */}
      <Link href="/drafts" style={{ color: '#5a6278', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '32px', textDecoration: 'none' }}>
        ← Back to drafts
      </Link>

      {/* Banners */}
      {held === 'true' && (
        <div style={{ background: 'rgba(107,114,128,0.1)', border: '1px solid rgba(107,114,128,0.2)', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', fontSize: '13px', color: '#9ba3b8' }}>
          This draft is on hold. You can still approve it from here.
        </div>
      )}
      {already_actioned === 'true' && (
        <div style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', fontSize: '13px', color: '#34d399' }}>
          ✓ This draft has already been actioned.
        </div>
      )}
      {item.status === 'HOLD_RECOMMENDED' && item.holdReason && (
        <div style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: '8px', padding: '16px 20px', marginBottom: '24px' }}>
          <p style={{ fontSize: '11px', color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
            Voyce recommends holding this draft
          </p>
          <p style={{ fontSize: '13px', color: '#f0f2f8' }}>{item.holdReason}</p>
        </div>
      )}
      {isDiscovery && (
        <div style={{ background: 'rgba(75,158,255,0.08)', border: '1px solid rgba(75,158,255,0.2)', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', fontSize: '13px', color: '#4b9eff' }}>
          Voice Discovery — choose the style closest to you. Your selection trains the system.
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <h1 style={{ fontSize: '26px', fontWeight: 600 }}>{formatType(item.contentType)}</h1>
          {item.platformTarget && (
            <span style={{ fontSize: '12px', color: '#4b9eff', background: 'rgba(75,158,255,0.1)', padding: '3px 10px', borderRadius: '4px' }}>
              {item.platformTarget}
            </span>
          )}
        </div>
        <p style={{ color: '#5a6278', fontSize: '12px' }}>
          {new Date(item.createdAt).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          {item.confidenceScore ? ` · Confidence ${Math.round(item.confidenceScore)}%` : ''}
        </p>
      </div>

      {/* Content */}
      <div
        style={{
          background: '#111318',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '10px',
          padding: '28px',
          marginBottom: '28px',
        }}
      >
        <div style={{ whiteSpace: 'pre-wrap', fontSize: '14px', lineHeight: 1.85, color: '#e0e4f0' }}>
          {fullContent}
        </div>
      </div>

      {/* Actions */}
      {canAct && (
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <a
            href={`/api/approvals/dashboard-approve-${item.id}`}
            style={{
              padding: '10px 22px', background: '#4b9eff', color: '#0d0e12', borderRadius: '6px',
              fontSize: '13px', fontWeight: 600, textDecoration: 'none', display: 'inline-block',
            }}
          >
            Approve & publish
          </a>
          <a
            href={`/revise?id=${item.id}`}
            style={{
              padding: '10px 22px', background: 'transparent', color: '#f0f2f8',
              border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px',
              fontSize: '13px', textDecoration: 'none', display: 'inline-block',
            }}
          >
            Request revision
          </a>
          {item.status !== 'ON_HOLD' && (
            <a
              href={`/api/approvals/dashboard-hold-${item.id}`}
              style={{
                padding: '10px 22px', background: 'transparent', color: '#5a6278',
                border: '1px solid rgba(255,255,255,0.07)', borderRadius: '6px',
                fontSize: '13px', textDecoration: 'none', display: 'inline-block',
              }}
            >
              Hold for now
            </a>
          )}
        </div>
      )}

      {item.status === 'APPROVED' && (
        <p style={{ color: '#34d399', fontSize: '13px' }}>
          ✓ Approved {item.approvedAt ? new Date(item.approvedAt).toLocaleDateString() : ''}
        </p>
      )}
      {item.status === 'PUBLISHED' && (
        <p style={{ color: '#34d399', fontSize: '13px' }}>✓ Published</p>
      )}
    </div>
  )
}
