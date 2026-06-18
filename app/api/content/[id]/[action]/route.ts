import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { applyApprovalAction } from '@/lib/approval-actions'
import type { ApprovalAction } from '@/lib/tokens'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
const VALID: ApprovalAction[] = ['approve', 'revise', 'hold']

// Authenticated in-app approve/hold/revise. The dashboard posts here instead of using
// emailed tokens — the action is scoped to the logged-in client, so a client can only
// act on their own content. This replaces the malformed token URLs the buttons used.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string; action: string }> }) {
  const { id, action } = await params

  if (!VALID.includes(action as ApprovalAction)) {
    return NextResponse.redirect(`${APP_URL}/approval-error?reason=invalid_action`, 303)
  }

  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.redirect(`${APP_URL}/login`, 303)
  }

  const client = await prisma.client.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  })
  if (!client) {
    return NextResponse.redirect(`${APP_URL}/login`, 303)
  }

  const { redirect } = await applyApprovalAction({
    clientId: client.id,
    contentItemId: id,
    action: action as ApprovalAction,
  })

  return NextResponse.redirect(redirect, 303)
}
