import { task, logger } from '@trigger.dev/sdk/v3'
import { prisma } from '@/lib/prisma'
import { getContent } from '@/lib/r2'
import { tryDecryptSecret } from '@/lib/crypto'
import { createBufferUpdate, BufferError } from '@/lib/buffer'
import { sendPublishFailedEmail } from '@/lib/email'
import { alertOps } from '@/lib/alert'

export interface PublishPayload {
  contentItemId: string
}

// Publishing pipeline: APPROVED → (Buffer) → PUBLISHED | PUBLISH_FAILED.
// If the client has no connected channel, this is an honest no-op: the item stays
// APPROVED with a note that manual publishing is required — we never claim to have
// published something we didn't.
export const publishTask = task({
  id: 'publish',
  queue: { name: 'publishing', concurrencyLimit: 5 },
  retry: { maxAttempts: 1 },
  run: async ({ contentItemId }: PublishPayload) => {
    const item = await prisma.contentItem.findUniqueOrThrow({
      where: { id: contentItemId },
      select: { id: true, clientId: true, status: true, storageKey: true, contentPreview: true, platformTarget: true, isDiscovery: true },
    })

    if (item.status !== 'APPROVED') {
      logger.info('Publish skipped — item not in APPROVED state', { contentItemId, status: item.status })
      return { published: false, reason: 'not_approved' }
    }

    // Defensive: a discovery calibration set is never published (it holds 3 variants).
    if (item.isDiscovery) {
      logger.info('Publish skipped — discovery calibration item', { contentItemId })
      return { published: false, reason: 'discovery' }
    }

    const client = await prisma.client.findUniqueOrThrow({
      where: { id: item.clientId },
      select: { email: true, name: true, bufferAccessToken: true, bufferProfileId: true },
    })

    const accessToken = tryDecryptSecret(client.bufferAccessToken)
    if (!accessToken || !client.bufferProfileId) {
      logger.info('No publishing channel connected — leaving item APPROVED for manual publishing', { contentItemId })
      await prisma.contentItem.update({
        where: { id: contentItemId },
        data: { publishError: 'No publishing channel connected — publish manually or connect Buffer in Settings.' },
      })
      return { published: false, reason: 'no_channel' }
    }

    let text = item.contentPreview ?? ''
    if (item.storageKey) {
      try {
        text = await getContent(item.storageKey)
      } catch (err) {
        logger.warn('Could not load full content from storage — publishing preview', { contentItemId, err: String(err) })
      }
    }

    await prisma.contentItem.update({ where: { id: contentItemId }, data: { status: 'PUBLISHING' } })

    try {
      const result = await createBufferUpdate({
        accessToken,
        profileId: client.bufferProfileId,
        text,
      })
      await prisma.contentItem.update({
        where: { id: contentItemId },
        data: {
          status: 'PUBLISHED',
          bufferJobId: result.id,
          publishedUrl: result.publishedUrl ?? null,
          publishedAt: new Date(),
          publishError: null,
        },
      })
      logger.info('Published to Buffer', { contentItemId, bufferJobId: result.id })
      return { published: true, bufferJobId: result.id }
    } catch (err) {
      const message = err instanceof BufferError ? err.message : (err as Error).message
      logger.error('Buffer publish failed', { contentItemId, message })
      await prisma.contentItem.update({
        where: { id: contentItemId },
        data: { status: 'PUBLISH_FAILED', publishError: message },
      })
      await alertOps('publish failed', { contentItemId, message })
      await sendPublishFailedEmail({
        to: client.email,
        clientName: client.name,
        contentItemId,
        reason: message,
      }).catch(() => null)
      return { published: false, reason: 'error', message }
    }
  },
})
