import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

export async function POST() {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.redirect(`${APP_URL}/login`, 303)

  const client = await prisma.client.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  })
  if (client) {
    await prisma.client.update({
      where: { id: client.id },
      data: { bufferAccessToken: null, bufferRefreshToken: null, bufferProfileId: null },
    })
  }

  return NextResponse.redirect(`${APP_URL}/settings?disconnected=buffer`, 303)
}
