import { task, logger } from '@trigger.dev/sdk/v3'
import { prisma } from '@/lib/prisma'
import { callClaude, buildCachedSystemPrompt } from '@/lib/claude'
import { assembleOnboardingSections, type OnboardingResponses } from '@/lib/mcf-assembly'
import { sendWelcomeEmail } from '@/lib/email'
import { contentProductionTask } from './content-production'

export interface McfBuildPayload {
  clientId: string
}

// Builds the Master Context File from the client's stored native-onboarding answers,
// then triggers the first production run. This task only fires AFTER payment is
// confirmed (from the Stripe checkout.session.completed handler), so an unpaid
// signup never reaches a Claude call.
export const mcfBuildTask = task({
  id: 'mcf-build',
  retry: { maxAttempts: 3 },
  run: async ({ clientId }: McfBuildPayload) => {
    logger.info('MCF build started', { clientId })

    const client = await prisma.client.findUniqueOrThrow({
      where: { id: clientId },
      select: { email: true, onboardingResponses: true },
    })

    if (!client.onboardingResponses) {
      logger.error('No onboarding responses stored — cannot build MCF', { clientId })
      return { clientId, error: 'no_onboarding_responses' }
    }

    const responses = JSON.parse(client.onboardingResponses) as OnboardingResponses
    const rawSections = assembleOnboardingSections(responses)

    // Synthesise the terse form answers into a precise, usable voice profile.
    const rawVoiceInput = `${rawSections.VOICE_PROFILE}\n\n${rawSections.EXAMPLES}`
    const { text: synthesisedVoiceProfile, inputTokens, outputTokens } = await callClaude({
      system: buildCachedSystemPrompt(
        `You are building a Brand Intelligence Layer for a content AI system. Synthesise raw onboarding answers into a precise, actionable voice profile that specialist agents use to match this founder's writing style.

Be specific and concrete. Do not use vague descriptors like "authentic" or "engaging." Describe observable writing behaviours: sentence length patterns, paragraph structure, characteristic openers, recurring phrases, tone markers, what this person would never write.`,
      ),
      messages: [{ role: 'user', content: `Synthesise this into a precise voice profile. Raw input:\n\n${rawVoiceInput}` }],
      maxTokens: 600,
    })

    logger.info('Voice profile synthesised', { inputTokens, outputTokens })

    const sectionUpserts = [
      { sectionType: 'VOICE_PROFILE' as const, content: synthesisedVoiceProfile },
      { sectionType: 'AUDIENCE' as const, content: rawSections.AUDIENCE },
      { sectionType: 'CONTENT_PILLARS' as const, content: rawSections.CONTENT_PILLARS },
      { sectionType: 'BRAND_OPINIONS' as const, content: rawSections.BRAND_OPINIONS },
      { sectionType: 'QUALITY_STANDARDS' as const, content: rawSections.QUALITY_STANDARDS },
      { sectionType: 'EXAMPLES' as const, content: rawSections.EXAMPLES },
      { sectionType: 'PLATFORM_CONFIG' as const, content: rawSections.PLATFORM_CONFIG },
    ]

    // Wrap section writes in a transaction — provider-agnostic, no lost updates.
    await prisma.$transaction(
      sectionUpserts.map((s) =>
        prisma.clientContext.upsert({
          where: { clientId_sectionType: { clientId, sectionType: s.sectionType } },
          update: { content: s.content, version: { increment: 1 }, updatedBy: 'mcf-build' },
          create: { clientId, sectionType: s.sectionType, content: s.content, updatedBy: 'mcf-build' },
        }),
      ),
    )

    await prisma.client.update({
      where: { id: clientId },
      data: {
        name: responses.name || undefined,
        companyName: responses.companyName || undefined,
        onboardingCompletedAt: new Date(),
      },
    })

    await sendWelcomeEmail({ to: client.email, clientName: responses.name })

    logger.info('MCF build complete — triggering first production run', { clientId })
    await contentProductionTask.trigger(
      {
        clientId,
        brief: "Produce a LinkedIn post on one of the client's primary content pillars.",
        contentType: 'LINKEDIN_POST',
        platformTarget: 'linkedin',
      },
      { concurrencyKey: clientId },
    )

    return { clientId, sectionsWritten: sectionUpserts.length }
  },
})
