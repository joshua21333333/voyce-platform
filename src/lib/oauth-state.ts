import { createHmac, timingSafeEqual } from 'crypto'

// Signed OAuth `state` to bind the callback to the client who started the flow
// (CSRF protection — prevents linking someone else's Buffer account to a victim).

function secret(): string {
  const s = process.env.AUTH_SECRET
  if (!s) throw new Error('AUTH_SECRET is not set — cannot sign OAuth state')
  return s
}

export function signState(clientId: string): string {
  const nonce = `${clientId}:${Date.now()}`
  const sig = createHmac('sha256', secret()).update(nonce).digest('hex')
  return Buffer.from(`${nonce}:${sig}`).toString('base64url')
}

export function verifyState(state: string): string | null {
  try {
    const decoded = Buffer.from(state, 'base64url').toString('utf-8')
    const parts = decoded.split(':')
    if (parts.length !== 3) return null
    const [clientId, ts, sig] = parts
    const expected = createHmac('sha256', secret()).update(`${clientId}:${ts}`).digest('hex')
    const a = Buffer.from(sig, 'hex')
    const b = Buffer.from(expected, 'hex')
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
    // 1-hour validity window
    if (Date.now() - Number(ts) > 60 * 60 * 1000) return null
    return clientId
  } catch {
    return null
  }
}
