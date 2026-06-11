import NextAuth from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import Resend from 'next-auth/providers/resend'
import Credentials from 'next-auth/providers/credentials'
import { prisma } from '@/lib/prisma'

const hasResend = Boolean(process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== 'NEEDS_EXTERNAL_SETUP')

// In development without Resend, allow a bypass credential for testing the UI.
const devBypassProvider = Credentials({
  id: 'dev-bypass',
  name: 'Dev bypass',
  credentials: { email: { label: 'Email', type: 'email' } },
  async authorize(credentials) {
    if (process.env.NODE_ENV !== 'development') return null
    const email = String(credentials?.email ?? '').toLowerCase().trim()
    if (!email) return null
    return { id: `dev-${email}`, email, name: email.split('@')[0] }
  },
})

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    ...(hasResend
      ? [Resend({ from: process.env.EMAIL_FROM ?? 'Voyce <auth@voyce.ai>' })]
      : []),
    ...(process.env.NODE_ENV === 'development' ? [devBypassProvider] : []),
  ],
  session: { strategy: hasResend ? 'database' : 'jwt' },
  pages: {
    signIn: '/login',
    verifyRequest: '/login/check-email',
  },
  callbacks: {
    session({ session, user, token }) {
      if (session.user) {
        session.user.id = (user?.id ?? token?.sub) as string
      }
      return session
    },
  },
})

declare module 'next-auth' {
  interface Session {
    user: { id: string; email: string; name?: string | null; image?: string | null }
  }
}
