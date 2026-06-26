import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/prisma'
import { generateApprovalToken } from '@/lib/tokens'
import { issueApprovalToken, consumeApprovalToken } from '@/lib/approvals'

// Real-DB integration: proves the security-critical single-use + expiry guarantee on
// approval tokens (the replay-proofing the second review demanded).

let clientId: string
let contentItemId: string

beforeAll(async () => {
  const client = await prisma.client.create({
    data: { email: `tok-${Date.now()}@test.local`, name: 'Tok Test', status: 'ACTIVE' },
  })
  clientId = client.id
  const item = await prisma.contentItem.create({
    data: { clientId, contentType: 'LINKEDIN_POST', status: 'DELIVERED' },
  })
  contentItemId = item.id
})

afterAll(async () => {
  await prisma.client.deleteMany({ where: { id: clientId } })
  await prisma.$disconnect()
})

describe('approval token lifecycle', () => {
  it('consumes a valid token exactly once', async () => {
    const token = await issueApprovalToken(clientId, contentItemId, 'approve')

    const first = await consumeApprovalToken(token)
    expect(first.ok).toBe(true)
    if (first.ok) {
      expect(first.contentItemId).toBe(contentItemId)
      expect(first.clientId).toBe(clientId)
    }

    // Replay attempt — must be rejected as already used.
    const second = await consumeApprovalToken(token)
    expect(second).toEqual({ ok: false, reason: 'used' })
  })

  it('rejects an expired token', async () => {
    const token = generateApprovalToken(contentItemId, 'hold')
    await prisma.approvalToken.create({
      data: {
        clientId,
        contentItemId,
        token,
        action: 'hold',
        expiresAt: new Date(Date.now() - 1000), // already expired
      },
    })
    expect(await consumeApprovalToken(token)).toEqual({ ok: false, reason: 'expired' })
  })

  it('rejects an unknown/forged token', async () => {
    expect(await consumeApprovalToken('forged-token')).toEqual({ ok: false, reason: 'invalid' })
  })
})
