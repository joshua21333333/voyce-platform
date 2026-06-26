import { prisma } from './prisma'
import type { ApprovalAction } from './tokens'
import { publishTask } from '@/trigger/publishing'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

// Statuses from which a client may still take an approval action.
const ACTIONABLE: string[] = ['DELIVERED', 'HOLD_RECOMMENDED', 'DRAFT', 'REVISION_REQUESTED']

export interface ApplyActionInput {
  clientId: string
  contentItemId: string
  action: ApprovalAction
  variantLabel?: string | null
}

// Single source of truth for what an approve / revise / hold does. Used by both the
// emailed-token route and the authenticated dashboard route.
export async function applyApprovalAction({
  clientId,
  contentItemId,
  action,
  variantLabel,
}: ApplyActionInput): Promise<{ redirect: string }> {
  const item = await prisma.contentItem.findUnique({
    where: { id: contentItemId },
    select: { id: true, status: true, clientId: true, isDiscovery: true },
  })

  if (!item || item.clientId !== clientId) {
    return { redirect: `${APP_URL}/approval-error?reason=not_found` }
  }

  if (!ACTIONABLE.includes(item.status)) {
    return { redirect: `${APP_URL}/drafts/${item.id}?already_actioned=true` }
  }

  switch (action) {
    case 'approve': {
      // Discovery Mode: client picked a variant — record it as a calibration example.
      // Read-modify-write wrapped in a transaction so concurrent writers to the
      // EXAMPLES row cannot lose the append (provider-agnostic).
      if (variantLabel) {
        await prisma.$transaction(async (tx) => {
          const existing = await tx.clientContext.findUnique({
            where: { clientId_sectionType: { clientId, sectionType: 'EXAMPLES' } },
            select: { content: true },
          })
          const note = `\n\n### Approved discovery variant: ${variantLabel}\n*(Selected by client as closest to their voice)*`
          await tx.clientContext.upsert({
            where: { clientId_sectionType: { clientId, sectionType: 'EXAMPLES' } },
            update: {
              content: (existing?.content ?? '') + note,
              version: { increment: 1 },
              updatedBy: 'discovery-selection',
            },
            create: {
              clientId,
              sectionType: 'EXAMPLES',
              content: note,
              updatedBy: 'discovery-selection',
            },
          })
        })
      }

      await prisma.$transaction([
        prisma.contentItem.update({
          where: { id: contentItemId },
          data: { status: 'APPROVED', approvedAt: new Date() },
        }),
        prisma.client.update({
          where: { id: clientId },
          data: { consecutiveApprovals: { increment: 1 } },
        }),
      ])

      // Discovery items are a 3-variant calibration set, not a publishable draft —
      // approving one records the style selection only (handled above) and never
      // publishes the concatenated variants.
      if (!item.isDiscovery) {
        await publishTask.trigger({ contentItemId }, { concurrencyKey: clientId })
      }

      return { redirect: `${APP_URL}/approved?id=${contentItemId}` }
    }

    case 'revise': {
      // Mark for revision; the actual regeneration is triggered once the client
      // submits revision notes via /api/revisions (the notes capture form).
      await prisma.$transaction([
        prisma.contentItem.update({
          where: { id: contentItemId },
          data: { status: 'REVISION_REQUESTED' },
        }),
        prisma.client.update({
          where: { id: clientId },
          data: { consecutiveApprovals: 0 },
        }),
      ])
      return { redirect: `${APP_URL}/revise?id=${contentItemId}` }
    }

    case 'hold': {
      await prisma.contentItem.update({
        where: { id: contentItemId },
        data: { status: 'ON_HOLD' },
      })
      return { redirect: `${APP_URL}/drafts/${contentItemId}?held=true` }
    }

    default:
      return { redirect: `${APP_URL}/approval-error?reason=invalid_action` }
  }
}
