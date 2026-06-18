import { prisma } from './prisma'
import { generateApprovalToken, verifyApprovalToken, type ApprovalAction } from './tokens'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

// Token issuance + consumption only. Action logic that triggers downstream jobs lives
// in src/lib/approval-actions.ts to keep this module free of trigger imports (email.ts
// depends on issuance, and publishing depends on email — importing actions here would
// create a cycle).

export async function issueApprovalToken(
  clientId: string,
  contentItemId: string,
  action: ApprovalAction,
): Promise<string> {
  const token = generateApprovalToken(contentItemId, action)
  await prisma.approvalToken.create({
    data: {
      clientId,
      contentItemId,
      token,
      action,
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    },
  })
  return token
}

export function approvalActionUrl(token: string, variantLabel?: string): string {
  const base = `${APP_URL}/api/approvals/${token}`
  return variantLabel ? `${base}?variant=${encodeURIComponent(variantLabel)}` : base
}

export type ConsumeResult =
  | { ok: true; clientId: string; contentItemId: string; action: ApprovalAction }
  | { ok: false; reason: 'invalid' | 'used' | 'expired' }

// Verifies the HMAC, then atomically marks the token consumed. The conditional
// updateMany (consumedAt: null AND not expired) guarantees single use even under
// concurrent clicks — a second click matches zero rows.
export async function consumeApprovalToken(token: string): Promise<ConsumeResult> {
  const verified = verifyApprovalToken(token)
  if (!verified) return { ok: false, reason: 'invalid' }

  const now = new Date()
  const claimed = await prisma.approvalToken.updateMany({
    where: { token, consumedAt: null, expiresAt: { gt: now } },
    data: { consumedAt: now },
  })

  if (claimed.count === 0) {
    const row = await prisma.approvalToken.findUnique({ where: { token } })
    if (!row) return { ok: false, reason: 'invalid' }
    if (row.consumedAt) return { ok: false, reason: 'used' }
    return { ok: false, reason: 'expired' }
  }

  const row = await prisma.approvalToken.findUniqueOrThrow({
    where: { token },
    select: { clientId: true, contentItemId: true, action: true },
  })
  return {
    ok: true,
    clientId: row.clientId,
    contentItemId: row.contentItemId,
    action: row.action as ApprovalAction,
  }
}
