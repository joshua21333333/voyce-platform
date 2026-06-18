import { task, logger } from '@trigger.dev/sdk/v3'
import { prisma } from '@/lib/prisma'
import { callClaude, buildCachedSystemPrompt } from '@/lib/claude'
import {
  extractFieldValues,
  assembleVoiceProfile,
  assembleAudience,
  assembleContentPillars,
  assembleBrandOpinions,
  assembleQualityStandards,
  assembleExamples,
  assemblePlatformConfig,
  type TallyWebhookPayload,
} from '@/lib/tally'
import { sendWelcomeEmail } from '@/lib/email'

export interface McfBuildPayload {
  clientId: string
  tallyData: TallyWebhookPayload['data']
}

export const mcfBuildTask = task({
  id: 'mcf-build',
  retry: { maxAttempts: 3 },
  run: async (payload: McfBuildPayload) => {
    const { clientId, tallyData } = payload

    logger.info('MCF build started', { clientId })

    // Extract field values from Tally submission
    const { dbFields, mcfSections } = extractFieldValues(tallyData.fields, 'onboarding')

    // Assemble raw section content from form fields
    const rawSections: Record<string, string> = {
      VOICE_PROFILE: assembleVoiceProfile(mcfSections['VOICE_PROFILE'] ?? {}),
      AUDIENCE: assembleAudience(mcfSections['AUDIENCE'] ?? {}),
      CONTENT_PILLARS: assembleContentPillars(mcfSections['CONTENT_PILLARS'] ?? {}),
      BRAND_OPINIONS: assembleBrandOpinions(mcfSections['BRAND_OPINIONS'] ?? {}),
      QUALITY_STANDARDS: assembleQualityStandards(mcfSections['QUALITY_STANDARDS'] ?? {}),
      EXAMPLES: assembleExamples(mcfSections['EXAMPLES'] ?? {}),
      PLATFORM_CONFIG: assemblePlatformConfig(mcfSections['PLATFORM_CONFIG'] ?? {}),
    }

    // Use Claude to synthesise the voice profile into a richer, more coherent description.
    // This is a single low-token call — it turns terse form answers into a usable voice profile.
    const rawVoiceInput = rawSections['VOICE_PROFILE'] + '\n\n' + rawSections['EXAMPLES']

    const { text: synthesisedVoiceProfile, inputTokens, outputTokens } = await callClaude({
      system: buildCachedSystemPrompt(
        `You are building a Brand Intelligence Layer for a content AI system. Your job is to synthesise raw onboarding form responses into a precise, actionable voice profile that specialist agents will use to match this founder's writing style.

Be specific and concrete. Do not use vague descriptors like "authentic" or "engaging." Instead, describe observable writing behaviours: sentence length patterns, paragraph structure, characteristic openers, recurring phrases, tone markers, what this person would never write.`,
      ),
      messages: [
        {
          role: 'user',
          content: `Synthesise this into a precise voice profile. Raw input:\n\n${rawVoiceInput}`,
        },
      ],
      maxTokens: 600,
    })

    logger.info('Voice profile synthesised', { inputTokens, outputTokens })

    // Write all MCF sections to the database
    const sectionUpserts = [
      { sectionType: 'VOICE_PROFILE' as const, content: synthesisedVoiceProfile },
      { sectionType: 'AUDIENCE' as const, content: rawSections['AUDIENCE'] },
      { sectionType: 'CONTENT_PILLARS' as const, content: rawSections['CONTENT_PILLARS'] },
      { sectionType: 'BRAND_OPINIONS' as const, content: rawSections['BRAND_OPINIONS'] },
      { sectionType: 'QUALITY_STANDARDS' as const, content: rawSections['QUALITY_STANDARDS'] },
      { sectionType: 'EXAMPLES' as const, content: rawSections['EXAMPLES'] },
      { sectionType: 'PLATFORM_CONFIG' as const, content: rawSections['PLATFORM_CONFIG'] },
    ]

    await Promise.all(
      sectionUpserts.map((s) =>
        prisma.clientContext.upsert({
          where: { clientId_sectionType: { clientId, sectionType: s.sectionType } },
          update: { content: s.content, version: { increment: 1 }, updatedBy: 'mcf-build' },
          create: { clientId, sectionType: s.sectionType, content: s.content, updatedBy: 'mcf-build' },
        }),
      ),
    )

    // Update client name/company from form fields
    await prisma.client.update({
      where: { id: clientId },
      data: {
        name: dbFields.name ?? undefined,
        companyName: dbFields.companyName ?? undefined,
        onboardingCompletedAt: new Date(),
      },
    })

    const client = await prisma.client.findUniqueOrThrow({
      where: { id: clientId },
      select: { name: true, email: true },
    })

    // Send welcome email. The FIRST production run is NOT triggered here — it fires
    // from the Stripe `checkout.session.completed` handler once payment is confirmed,
    // so an unpaid Tally submission never produces (or emails) any content.
    await sendWelcomeEmail({ to: client.email, clientName: client.name })

    logger.info('MCF build complete — awaiting payment to trigger first production', { clientId })

    return { clientId, sectionsWritten: sectionUpserts.length }
  },
})
