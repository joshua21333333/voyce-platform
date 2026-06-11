import NextAuth from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import Resend from 'next-auth/providers/resend'
import { prisma } from '@/lib/prisma'

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Resend({
      from: process.env.EMAIL_FROM ?? 'Voyce <auth@voyce.ai>',
    }),
  ],
  pages: {
    signIn: '/login',
    verifyRequest: '/login/check-email',
  },
  callbacks: {
    session({ session, user }) {
      if (session.user) session.user.id = user.id
      return session
    },
  },
})

declare module 'next-auth' {
  interface Session {
    user: { id: string; email: string; name?: string | null; image?: string | null }
  }
}
