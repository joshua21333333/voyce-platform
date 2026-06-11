import { redirect } from 'next/navigation'
import { auth, signIn } from '@/auth'

const hasResend = Boolean(process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== 'NEEDS_EXTERNAL_SETUP')
const isDev = process.env.NODE_ENV === 'development'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const session = await auth()
  if (session) redirect('/drafts')

  const { error } = await searchParams

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FAF7F2',
        padding: '24px',
      }}
    >
      <div style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '28px', fontWeight: 600, letterSpacing: '0.05em', marginBottom: '8px' }}>
            Voyce
          </p>
          <p style={{ color: '#888', fontSize: '13px' }}>Content that sounds like you</p>
        </div>

        <div style={{ background: '#fff', border: '1px solid #E4DDD2', borderRadius: '8px', padding: '32px' }}>
          <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '22px', fontWeight: 600, marginBottom: '8px' }}>
            Sign in
          </h1>
          <p style={{ color: '#888', fontSize: '13px', marginBottom: '28px' }}>
            {hasResend ? "Enter your email and we'll send you a sign-in link." : 'Enter your email to access the dashboard.'}
          </p>

          {!hasResend && isDev && (
            <div style={{ background: '#FBF3E2', border: '1px solid #F0D98C', borderRadius: '4px', padding: '10px 14px', marginBottom: '20px', fontSize: '12px', color: '#8A6E1E' }}>
              Dev mode — Resend not configured. Signing in directly.
            </div>
          )}

          {error && (
            <div style={{ background: '#FBE9E7', border: '1px solid #FFCCBC', borderRadius: '4px', padding: '12px 16px', marginBottom: '20px', fontSize: '13px', color: '#BF360C' }}>
              Sign-in failed. Please try again.
            </div>
          )}

          <form
            action={async (formData: FormData) => {
              'use server'
              await signIn(hasResend ? 'resend' : 'dev-bypass', { ...Object.fromEntries(formData), redirectTo: '/drafts' })
            }}
          >
            <div style={{ marginBottom: '16px' }}>
              <label
                htmlFor="email"
                style={{ display: 'block', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#888', marginBottom: '8px' }}
              >
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
                  width: '100%', padding: '10px 14px', border: '1px solid #E4DDD2', borderRadius: '4px',
                  fontFamily: "'DM Mono', monospace", fontSize: '14px', backgroundColor: '#FAF7F2', color: '#1a1a1a', outline: 'none',
                }}
              />
            </div>
            <button
              type="submit"
              style={{
                width: '100%', padding: '12px', background: '#C8A95A', color: '#fff', border: 'none',
                borderRadius: '4px', fontFamily: "'DM Mono', monospace", fontSize: '13px', fontWeight: 500, cursor: 'pointer',
              }}
            >
              {hasResend ? 'Send sign-in link' : 'Continue to dashboard'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
