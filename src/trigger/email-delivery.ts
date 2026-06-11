import { task, logger } from '@trigger.dev/sdk/v3'
import { prisma } from '@/lib/prisma'
import {
  sendDraftEmail,
  sendDiscoveryEmail,
  sendHoldRecommendationEmail,
  sendFollowUpEmail,
} from '@/lib/email'
import { contentProductionTask } from './content-production'
import type { ContentType } from '@prisma/client'

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
        clientName: client.name,
        contentItemId,
        variants: payload.variants ?? [],
      })
    } else if (mode === 'hold_recommended') {
      await sendHoldRecommendationEmail({
        to: client.email,
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
        clientName: client.name,
        contentItemId,
        contentType: payload.contentType ?? 'draft',
        preview: payload.preview ?? '',
        fullDraftText: payload.draftText ?? '',
      })
      await prisma.contentItem.update({
        where: { id: contentItemId },
        data: { status: 'DELIVERED', deliveredAt: new Date() },
      })
    }

    // Schedule 48-hour follow-up nudge (only for standard drafts awaiting approval)
    if (mode === 'standard') {
      await followUpTask.trigger({ clientId, contentItemId, contentType: payload.contentType ?? 'draft', preview: payload.preview ?? '' }, { delay: '48h' })
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
      clientName: client.name,
      contentItemId: payload.contentItemId,
      contentType: payload.contentType,
      preview: payload.preview,
    })

    return { nudgeSent: true }
  },
})

// Weekly production scheduler — runs per active client
export const weeklyProductionTask = task({
  id: 'weekly-production',
  run: async (payload: { clientId: string; contentType: ContentType; brief: string; platformTarget: string }) => {
    const client = await prisma.client.findUnique({
      where: { id: payload.clientId },
      select: { status: true },
    })

    if (client?.status !== 'ACTIVE') {
      logger.info('Skipping production for non-active client', { clientId: payload.clientId })
      return { skipped: true }
    }

    await contentProductionTask.trigger(payload)
    return { triggered: true }
  },
})
