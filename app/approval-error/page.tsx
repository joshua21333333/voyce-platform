import Link from 'next/link'
import { VoyceLogoPng } from '@/components/VoyceLogo'

const REASONS: Record<string, string> = {
  invalid: 'This link is not valid. It may have been altered or copied incorrectly.',
  used: 'This link has already been used. Each approval link works once.',
  expired: 'This link has expired. Approval links are valid for 7 days.',
  not_found: "We couldn't find that draft.",
  invalid_action: 'That action is not recognized.',
}

export default async function ApprovalErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>
}) {
  const { reason } = await searchParams
  const message = REASONS[reason ?? ''] ?? 'Something went wrong with that link.'

  return (
    <div className="bg-grid" style={{ minHeight: '100vh', backgroundColor: '#0a0b0f', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center' }}>
      <div style={{ maxWidth: '400px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '28px' }}>
          <VoyceLogoPng size={36} />
        </div>
        <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', fontSize: '20px', color: '#f87171' }}>
          !
        </div>
        <h1 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '10px' }}>Link unavailable</h1>
        <p style={{ color: '#9ba3b8', fontSize: '14px', lineHeight: 1.7, marginBottom: '32px' }}>{message}</p>
        <Link href="/drafts" style={{ display: 'inline-block', padding: '10px 24px', background: '#4b9eff', color: '#0d0e12', borderRadius: '6px', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }}>
          Go to your drafts
        </Link>
      </div>
    </div>
  )
}
