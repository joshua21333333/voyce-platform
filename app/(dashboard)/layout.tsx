import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import Link from 'next/link'
import { VoyceLogoPng } from '@/components/VoyceLogo'

const navLinks = [
  { href: '/dashboard',   label: 'Dashboard' },
  { href: '/drafts',      label: 'Drafts' },
  { href: '/calendar',   label: 'Calendar' },
  { href: '/performance', label: 'Performance' },
  { href: '/settings',   label: 'Settings' },
]

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/login')

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0d0e12', color: '#f0f2f8' }}>

      {/* Top nav */}
      <nav
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          height: '52px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          backgroundColor: 'rgba(13,14,18,0.85)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {/* Left: logo + nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
          <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '9px', textDecoration: 'none' }}>
            <VoyceLogoPng size={26} />
            <span style={{ fontSize: '16px', fontWeight: 600, letterSpacing: '0.04em', color: '#f0f2f8' }}>
              Voyce
            </span>
          </Link>

          <div style={{ display: 'flex', gap: '4px' }}>
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  color: '#9ba3b8',
                  textDecoration: 'none',
                  transition: 'color 0.15s, background 0.15s',
                }}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Right: email */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '12px', color: '#5a6278' }}>
            {session.user?.email}
          </span>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: 'rgba(75,158,255,0.15)',
              border: '1px solid rgba(75,158,255,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '11px',
              color: '#4b9eff',
              fontWeight: 600,
            }}
          >
            {session.user?.email?.[0]?.toUpperCase() ?? 'V'}
          </div>
        </div>
      </nav>

      {/* Page */}
      <main style={{ maxWidth: '1040px', margin: '0 auto', padding: '40px 24px' }}>
        {children}
      </main>

      {/* Footer */}
      <footer
        style={{
          maxWidth: '1040px',
          margin: '0 auto',
          padding: '24px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '12px',
          color: '#5a6278',
        }}
      >
        <span>© Voyce — the autonomous content platform built on Claude.</span>
        <a
          href="https://usevoyce.lovable.app"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#9ba3b8', textDecoration: 'none' }}
        >
          Visit usevoyce.com →
        </a>
      </footer>
    </div>
  )
}
