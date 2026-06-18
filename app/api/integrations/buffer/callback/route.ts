import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { exchangeBufferCode, fetchBufferProfiles } from '@/lib/buffer'
import { encryptSecret } from '@/lib/crypto'
import { verifyState } from '@/lib/oauth-state'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

// Buffer redirects here with ?code & ?state. We require an authenticated session AND
// a valid state bound to that same client, then store the access token encrypted.
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.redirect(`${APP_URL}/login`)

  const code = req.nextUrl.searchParams.get('code')
  const state = req.nextUrl.searchParams.get('state')
  if (!code || !state) {
    return NextResponse.redirect(`${APP_URL}/settings?error=buffer_missing_code`)
  }

  const stateClientId = verifyState(state)
  if (!stateClientId) {
    return NextResponse.redirect(`${APP_URL}/settings?error=buffer_bad_state`)
  }

  const client = await prisma.client.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  })
  if (!client || client.id !== stateClientId) {
    return NextResponse.redirect(`${APP_URL}/settings?error=buffer_state_mismatch`)
  }

  try {
    const accessToken = await exchangeBufferCode(code)
    const profiles = await fetchBufferProfiles(accessToken)
    if (profiles.length === 0) {
      return NextResponse.redirect(`${APP_URL}/settings?error=buffer_no_profiles`)
    }

    await prisma.client.update({
      where: { id: client.id },
      data: {
        bufferAccessToken: encryptSecret(accessToken),
        bufferProfileId: profiles[0].id,
      },
    })

    return NextResponse.redirect(`${APP_URL}/settings?connected=buffer`)
  } catch {
    return NextResponse.redirect(`${APP_URL}/settings?error=buffer_exchange_failed`)
  }
}
