import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/prisma'
import { applyApprovalAction } from '@/lib/approval-actions'

// Real-DB integration: automates the concurrent-write verification the Postgres
// migration runbook (docs/postgres-migration.md, step 6) demands. Fires two
// simultaneous discovery-variant approvals for one client and asserts BOTH appends
// land on the shared EXAMPLES context row — i.e. no lost update. The append is wrapped
// in an interactive transaction, so the behaviour is provider-agnostic: it holds on
// SQLite (serialised) and on Postgres (concurrent) alike.

let clientId: string
let itemA: string
let itemB: string

beforeAll(async () => {
  const client = await prisma.client.create({
    data: { email: `conc-${Date.now()}@test.local`, name: 'Conc Test', status: 'ACTIVE' },
  })
  clientId = client.id

  const a = await prisma.contentItem.create({
    data: { clientId, contentType: 'LINKEDIN_POST', status: 'DRAFT', isDiscovery: true },
  })
  const b = await prisma.contentItem.create({
    data: { clientId, contentType: 'LINKEDIN_POST', status: 'DRAFT', isDiscovery: true },
  })
  itemA = a.id
  itemB = b.id
})

afterAll(async () => {
  await prisma.client.deleteMany({ where: { id: clientId } })
  await prisma.$disconnect()
})

describe('concurrent EXAMPLES appends (postgres-migration runbook step 6)', () => {
  it('does not lose an update when two discovery approvals race', async () => {
    await Promise.all([
      applyApprovalAction({ clientId, contentItemId: itemA, action: 'approve', variantLabel: 'Direct & Opinionated' }),
      applyApprovalAction({ clientId, contentItemId: itemB, action: 'approve', variantLabel: 'Narrative & Story-driven' }),
    ])

    const examples = await prisma.clientContext.findUnique({
      where: { clientId_sectionType: { clientId, sectionType: 'EXAMPLES' } },
      select: { content: true },
    })

    // Both appends survived — the second writer serialised behind the first rather
    // than clobbering it.
    expect(examples?.content).toContain('Direct & Opinionated')
    expect(examples?.content).toContain('Narrative & Story-driven')
  })
})
