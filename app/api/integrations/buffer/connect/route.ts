import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { bufferConfigured, bufferAuthorizeUrl } from '@/lib/buffer'
import { signState } from '@/lib/oauth-state'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

// Starts the Buffer OAuth flow for the logged-in client.
export async function GET() {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.redirect(`${APP_URL}/login`)

  if (!bufferConfigured()) {
    return NextResponse.redirect(`${APP_URL}/settings?error=buffer_not_configured`)
  }

  const client = await prisma.client.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  })
  if (!client) return NextResponse.redirect(`${APP_URL}/login`)

  return NextResponse.redirect(bufferAuthorizeUrl(signState(client.id)))
}
