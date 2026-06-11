import Link from 'next/link'

export default function ApprovedPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FAF7F2',
        padding: '24px',
        textAlign: 'center',
      }}
    >
      <div style={{ maxWidth: '400px' }}>
        <p
          style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: '28px',
            fontWeight: 600,
            letterSpacing: '0.05em',
            marginBottom: '32px',
          }}
        >
          Voyce
        </p>
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: '#E8F5E9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px',
            fontSize: '24px',
          }}
        >
          ✓
        </div>
        <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '26px', marginBottom: '12px' }}>
          Approved
        </h1>
        <p style={{ color: '#666', fontSize: '14px', lineHeight: 1.7, marginBottom: '32px' }}>
          Your content has been approved and queued for publishing.
        </p>
        <Link
          href="/drafts"
          style={{
            display: 'inline-block',
            padding: '12px 24px',
            background: '#C8A95A',
            color: '#fff',
            borderRadius: '4px',
            fontFamily: "'DM Mono', monospace",
            fontSize: '13px',
            textDecoration: 'none',
          }}
        >
          Back to drafts
        </Link>
      </div>
    </div>
  )
}
