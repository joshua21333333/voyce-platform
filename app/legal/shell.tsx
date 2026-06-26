import Link from 'next/link'

export function LegalShell({
  title,
  updated,
  children,
}: {
  title: string
  updated: string
  children: React.ReactNode
}) {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0b0f', color: '#e0e4f0', padding: '64px 24px' }}>
      <article style={{ maxWidth: '680px', margin: '0 auto' }}>
        <Link href="/" style={{ color: '#5a6278', fontSize: '13px', textDecoration: 'none' }}>← Voyce</Link>
        <h1 style={{ fontSize: '32px', fontWeight: 600, margin: '24px 0 6px' }}>{title}</h1>
        <p style={{ color: '#5a6278', fontSize: '12px', marginBottom: '40px' }}>Last updated {updated}</p>
        {children}
        <p style={{ color: '#5a6278', fontSize: '12px', marginTop: '48px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '20px' }}>
          Questions about this policy? Reply to any Voyce email or contact support.
        </p>
      </article>
    </div>
  )
}

export function H2({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontSize: '17px', fontWeight: 600, color: '#f0f2f8', margin: '32px 0 10px' }}>{children}</h2>
}

export function P({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: '14px', lineHeight: 1.8, color: '#b8bfd0', marginBottom: '12px' }}>{children}</p>
}
