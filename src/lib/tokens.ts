import { createHmac, randomBytes, timingSafeEqual } from 'crypto'

// HMAC layer for approval links. This proves a token was minted by us; single-use,
// expiry, and tenant binding are enforced by the persisted ApprovalToken row (see
// src/lib/approvals.ts). There is no dev fallback secret — an unset AUTH_SECRET is a
// hard error so we never issue forgeable tokens.

function tokenSecret(): string {
  const secret = process.env.AUTH_SECRET
  if (!secret) {
    throw new Error('AUTH_SECRET is not set — refusing to mint or verify approval tokens')
  }
  return secret
}

export type ApprovalAction = 'approve' | 'revise' | 'hold'

const ACTIONS: ApprovalAction[] = ['approve', 'revise', 'hold']

export function generateApprovalToken(contentItemId: string, action: ApprovalAction): string {
  const random = randomBytes(16).toString('hex')
  const payload = `${contentItemId}:${action}:${random}`
  const sig = createHmac('sha256', tokenSecret()).update(payload).digest('hex')
  return Buffer.from(`${payload}:${sig}`).toString('base64url')
}

export function verifyApprovalToken(token: string): {
  contentItemId: string
  action: ApprovalAction
} | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf-8')
    const parts = decoded.split(':')
    if (parts.length !== 4) return null
    const [contentItemId, action, random, sig] = parts
    const payload = `${contentItemId}:${action}:${random}`
    const expected = createHmac('sha256', tokenSecret()).update(payload).digest('hex')
    const sigBuf = Buffer.from(sig, 'hex')
    const expBuf = Buffer.from(expected, 'hex')
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null
    if (!ACTIONS.includes(action as ApprovalAction)) return null
    return { contentItemId, action: action as ApprovalAction }
  } catch {
    return null
  }
}
