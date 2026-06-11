import { createHmac, randomBytes } from 'crypto'

const TOKEN_SECRET = process.env.AUTH_SECRET ?? 'fallback-dev-secret'

export function generateApprovalToken(
  contentItemId: string,
  action: 'approve' | 'revise' | 'hold',
): string {
  const random = randomBytes(16).toString('hex')
  const payload = `${contentItemId}:${action}:${random}`
  const sig = createHmac('sha256', TOKEN_SECRET).update(payload).digest('hex')
  return Buffer.from(`${payload}:${sig}`).toString('base64url')
}

export function verifyApprovalToken(token: string): {
  contentItemId: string
  action: 'approve' | 'revise' | 'hold'
} | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf-8')
    const parts = decoded.split(':')
    if (parts.length !== 4) return null
    const [contentItemId, action, random, sig] = parts
    const payload = `${contentItemId}:${action}:${random}`
    const expected = createHmac('sha256', TOKEN_SECRET).update(payload).digest('hex')
    if (sig !== expected) return null
    if (!['approve', 'revise', 'hold'].includes(action)) return null
    return { contentItemId, action: action as 'approve' | 'revise' | 'hold' }
  } catch {
    return null
  }
}
