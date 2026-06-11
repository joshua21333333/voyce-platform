import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import Link from 'next/link'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/login')

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#FAF7F2' }}>
      {/* Nav */}
      <nav
        style={{
          borderBottom: '1px solid #E4DDD2',
          backgroundColor: '#FAF7F2',
          padding: '0 32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '56px',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
          <span
            style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize: '20px',
              fontWeight: 600,
              letterSpacing: '0.05em',
            }}
          >
            Voyce
          </span>
          <div style={{ display: 'flex', gap: '24px' }}>
            {[
              { href: '/drafts', label: 'Drafts' },
              { href: '/calendar', label: 'Calendar' },
              { href: '/performance', label: 'Performance' },
              { href: '/settings', label: 'Settings' },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  color: '#666',
                  textDecoration: 'none',
                  fontSize: '13px',
                  letterSpacing: '0.02em',
                }}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
        <span style={{ color: '#888', fontSize: '12px' }}>{session.user?.email}</span>
      </nav>

      {/* Page content */}
      <main style={{ maxWidth: '960px', margin: '0 auto', padding: '40px 32px' }}>{children}</main>
    </div>
  )
}
