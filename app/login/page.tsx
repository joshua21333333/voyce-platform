import { redirect } from 'next/navigation'
import { auth, signIn } from '@/auth'
import { VoyceLogoPng } from '@/components/VoyceLogo'

const hasResend = Boolean(process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== 'NEEDS_EXTERNAL_SETUP')
const isDev = process.env.NODE_ENV === 'development'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const session = await auth()
  if (session) redirect('/dashboard')
  const { error } = await searchParams

  return (
    <div className="bg-grid" style={{ minHeight: '100vh', backgroundColor: '#0a0b0f', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center', marginBottom: '20px' }}>
          <VoyceLogoPng size={36} />
          <span style={{ fontSize: '22px', fontWeight: 600, letterSpacing: '0.04em', color: '#f0f2f8' }}>
            Voyce
          </span>
        </div>

        {/* Marketing site link */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <a
            href="https://usevoyce.lovable.app"
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: '13px', color: '#4b9eff', textDecoration: 'none' }}
          >
            Visit usevoyce.com →
          </a>
        </div>

        {/* Card */}
        <div style={{ background: '#111318', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '32px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 600, marginBottom: '6px', color: '#f0f2f8' }}>
            Sign in
          </h1>
          <p style={{ color: '#9ba3b8', fontSize: '13px', marginBottom: '28px' }}>
            {hasResend ? "We'll send you a magic link." : 'Enter your email to continue.'}
          </p>

          {/* Dev mode banner */}
          {!hasResend && isDev && (
            <div style={{ background: 'rgba(75,158,255,0.08)', border: '1px solid rgba(75,158,255,0.2)', borderRadius: '6px', padding: '10px 14px', marginBottom: '20px', fontSize: '12px', color: '#4b9eff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ opacity: 0.7 }}>⚡</span>
              Dev mode — sign in directly without email
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: '6px', padding: '10px 14px', marginBottom: '20px', fontSize: '13px', color: '#f87171' }}>
              Sign-in failed. Please try again.
            </div>
          )}

          <form
            action={async (formData: FormData) => {
              'use server'
              await signIn(hasResend ? 'resend' : 'dev-bypass', {
                ...Object.fromEntries(formData),
                redirectTo: '/dashboard',
              })
            }}
          >
            <div style={{ marginBottom: '16px' }}>
              <label htmlFor="email" style={{ display: 'block', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#5a6278', marginBottom: '8px' }}>
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@company.com"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: '#0d0e12',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '6px',
                  color: '#f0f2f8',
                  fontSize: '14px',
                  outline: 'none',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            <button
              type="submit"
              style={{
                width: '100%',
                padding: '11px',
                background: '#4b9eff',
                color: '#0d0e12',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
                letterSpacing: '0.01em',
              }}
            >
              {hasResend ? 'Send sign-in link' : 'Continue →'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: '24px', color: '#5a6278', fontSize: '12px' }}>
          The autonomous content platform built on Claude.
        </p>
      </div>
    </div>
  )
}
