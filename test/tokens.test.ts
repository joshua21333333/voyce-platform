import { describe, it, expect } from 'vitest'
import { generateApprovalToken, verifyApprovalToken } from '@/lib/tokens'

describe('approval tokens (HMAC layer)', () => {
  it('verifies a freshly minted token', () => {
    const token = generateApprovalToken('content_123', 'approve')
    expect(verifyApprovalToken(token)).toEqual({ contentItemId: 'content_123', action: 'approve' })
  })

  it('rejects a tampered token', () => {
    const token = generateApprovalToken('content_123', 'approve')
    const tampered = token.slice(0, -2) + (token.endsWith('A') ? 'BB' : 'AA')
    expect(verifyApprovalToken(tampered)).toBeNull()
  })

  it('rejects garbage', () => {
    expect(verifyApprovalToken('clearly-not-a-token')).toBeNull()
  })

  it('round-trips each action type', () => {
    for (const action of ['approve', 'revise', 'hold'] as const) {
      const token = generateApprovalToken('x', action)
      expect(verifyApprovalToken(token)?.action).toBe(action)
    }
  })
})
