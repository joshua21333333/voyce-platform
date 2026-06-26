import { NextRequest, NextResponse } from 'next/server'
import { consumeApprovalToken } from '@/lib/approvals'
import { applyApprovalAction } from '@/lib/approval-actions'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

// Emailed approval links. The token is single-use, expiring, and tenant-bound (its
// clientId is persisted). consumeApprovalToken atomically burns it before the action
// runs, so a forwarded or re-opened link cannot replay a publish.
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const variantLabel = req.nextUrl.searchParams.get('variant')

  const consumed = await consumeApprovalToken(token)
  if (!consumed.ok) {
    return NextResponse.redirect(`${APP_URL}/approval-error?reason=${consumed.reason}`)
  }

  const { redirect } = await applyApprovalAction({
    clientId: consumed.clientId,
    contentItemId: consumed.contentItemId,
    action: consumed.action,
    variantLabel,
  })

  return NextResponse.redirect(redirect)
}
