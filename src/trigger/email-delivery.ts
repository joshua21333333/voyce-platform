import { task, logger } from '@trigger.dev/sdk/v3'
import { prisma } from '@/lib/prisma'
import {
  sendDraftEmail,
  sendDiscoveryEmail,
  sendHoldRecommendationEmail,
  sendFollowUpEmail,
} from '@/lib/email'

export interface EmailDeliveryPayload {
  clientId: string
  contentItemId: string
  mode: 'standard' | 'discovery' | 'hold_recommended'
  draftText?: string
  contentType?: string
  preview?: string
  holdReason?: string
  variants?: Array<{ label: string; draft: string }>
}

// Meters exactly one Content Action per delivered item. The conditional updateMany
// (meteredAt: null) makes this idempotent: re-delivery of a revised item, or a retried
// delivery job, never double-charges. "1 Content Action = 1 delivered item."
async function meterDelivery(clientId: string, contentItemId: string): Promise<void> {
  const claimed = await prisma.contentItem.updateMany({
    where: { id: contentItemId, meteredAt: null },
    data: { meteredAt: new Date() },
  })
  if (claimed.count > 0) {
    await prisma.client.update({
      where: { id: clientId },
      data: { contentActionsUsed: { increment: 1 } },
    })
  }
}

export const emailDeliveryTask = task({
  id: 'email-delivery',
  retry: { maxAttempts: 3 },
  run: async (payload: EmailDeliveryPayload) => {
    const { clientId, contentItemId, mode } = payload

    const client = await prisma.client.findUniqueOrThrow({
      where: { id: clientId },
      select: { name: true, email: true },
    })

    logger.info('Delivering email', { clientId, contentItemId, mode })

    if (mode === 'discovery') {
      await sendDiscoveryEmail({
        to: client.email,
        clientId,
        clientName: client.name,
        contentItemId,
        variants: payload.variants ?? [],
      })
      await prisma.contentItem.update({
        where: { id: contentItemId },
        data: { status: 'DELIVERED', deliveredAt: new Date() },
      })
    } else if (mode === 'hold_recommended') {
      await sendHoldRecommendationEmail({
        to: client.email,
        clientId,
        clientName: client.name,
        contentItemId,
        contentType: payload.contentType ?? 'draft',
        holdReason: payload.holdReason ?? 'Timing concern flagged by Orchestrator.',
      })
      await prisma.contentItem.update({
        where: { id: contentItemId },
        data: { status: 'HOLD_RECOMMENDED' },
      })
    } else {
      await sendDraftEmail({
        to: client.email,
        clientId,
        clientName: client.name,
        contentItemId,
        contentType: payload.contentType ?? 'draft',
        fullDraftText: payload.draftText ?? '',
      })
      await prisma.contentItem.update({
        where: { id: contentItemId },
        data: { status: 'DELIVERED', deliveredAt: new Date() },
      })
    }

    // Every delivered item (draft, discovery, or hold) counts as one Content Action.
    await meterDelivery(clientId, contentItemId)

    // Schedule 48-hour follow-up nudge for items awaiting a client decision.
    if (mode === 'standard' || mode === 'discovery') {
      await followUpTask.trigger(
        { clientId, contentItemId, contentType: payload.contentType ?? 'draft', preview: payload.preview ?? '' },
        { delay: '48h' },
      )
    }

    return { delivered: true }
  },
})

// Fires 48 hours after draft delivery if no approval has been recorded
export const followUpTask = task({
  id: 'follow-up-nudge',
  run: async (payload: { clientId: string; contentItemId: string; contentType: string; preview: string }) => {
    const item = await prisma.contentItem.findUnique({
      where: { id: payload.contentItemId },
      select: { status: true },
    })

    // Only nudge if still awaiting response
    if (!item || item.status !== 'DELIVERED') {
      logger.info('Follow-up skipped — item already actioned', { contentItemId: payload.contentItemId })
      return { skipped: true }
    }

    const client = await prisma.client.findUniqueOrThrow({
      where: { id: payload.clientId },
      select: { name: true, email: true },
    })

    await sendFollowUpEmail({
      to: client.email,
      clientId: payload.clientId,
      clientName: client.name,
      contentItemId: payload.contentItemId,
      contentType: payload.contentType,
      preview: payload.preview,
    })

    return { nudgeSent: true }
  },
})
