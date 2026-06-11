import Link from 'next/link'
import { VoyceNib } from '@/components/VoyceLogo'

export default function ApprovedPage() {
  return (
    <div className="bg-grid" style={{ minHeight: '100vh', backgroundColor: '#0a0b0f', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center' }}>
      <div style={{ maxWidth: '380px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '28px' }}>
          <VoyceNib size={28} color="#4b9eff" />
        </div>
        <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', fontSize: '20px' }}>
          ✓
        </div>
        <h1 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '10px' }}>Approved</h1>
        <p style={{ color: '#9ba3b8', fontSize: '14px', lineHeight: 1.7, marginBottom: '32px' }}>
          Your content has been approved and queued for publishing.
        </p>
        <Link href="/drafts" style={{ display: 'inline-block', padding: '10px 24px', background: '#4b9eff', color: '#0d0e12', borderRadius: '6px', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }}>
          Back to drafts
        </Link>
      </div>
    </div>
  )
}
