import { schedules, logger } from '@trigger.dev/sdk/v3'
import { prisma } from '@/lib/prisma'
import { contentProductionTask } from './content-production'
import { sendActivityUpdateEmail } from '@/lib/email'
import type { ContentType } from '@prisma/client'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

// Default weekly brief until per-client cadence/brief selection ships (Sprint 2).
const DEFAULT_BRIEF = "Produce a post on one of the client's primary content pillars."
const DEFAULT_CONTENT_TYPE: ContentType = 'LINKEDIN_POST'
const DEFAULT_PLATFORM = 'linkedin'

// ─── Weekly production — the core recurring loop ──────────────────────────────
// Replaces the inert plain task(): this is a registered cron that actually fires.
// Enumerates ACTIVE, onboarded clients under their action limit and triggers one
// production run each, serialized per-client via concurrencyKey.
export const weeklyProductionScheduler = schedules.task({
  id: 'weekly-production',
  cron: '0 13 * * 1', // Mondays 13:00 UTC
  run: async () => {
    const clients = await prisma.client.findMany({
      where: { status: 'ACTIVE', onboardingCompletedAt: { not: null } },
      select: { id: true, contentActionsUsed: true, contentActionsLimit: true },
    })

    let triggered = 0
    for (const client of clients) {
      if (client.contentActionsUsed >= client.contentActionsLimit) continue
      await contentProductionTask.trigger(
        {
          clientId: client.id,
          brief: DEFAULT_BRIEF,
          contentType: DEFAULT_CONTENT_TYPE,
          platformTarget: DEFAULT_PLATFORM,
        },
        { concurrencyKey: client.id },
      )
      triggered++
    }

    logger.info('Weekly production scheduled', { eligible: clients.length, triggered })
    return { triggered }
  },
})

// ─── Biweekly activity check-in ───────────────────────────────────────────────
// Replaces Agent 10 (Apify scraper) for early stage: emails each active client the
// activity-update form so RECENT_ACTIVITY stays fresh without scraping.
export const biweeklyActivityUpdate = schedules.task({
  id: 'biweekly-activity-update',
  cron: '0 14 1,15 * *', // 1st and 15th of each month, 14:00 UTC
  run: async () => {
    const formUrl = process.env.TALLY_ACTIVITY_FORM_URL ?? `${APP_URL}/settings`

    const clients = await prisma.client.findMany({
      where: { status: 'ACTIVE', onboardingCompletedAt: { not: null } },
      select: { name: true, email: true },
    })

    let sent = 0
    for (const client of clients) {
      try {
        await sendActivityUpdateEmail({ to: client.email, clientName: client.name, formUrl })
        sent++
      } catch (err) {
        logger.warn('Activity-update email failed', { email: client.email, err: String(err) })
      }
    }

    logger.info('Biweekly activity update sent', { eligible: clients.length, sent })
    return { sent }
  },
})
