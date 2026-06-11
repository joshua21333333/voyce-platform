import { task, logger } from '@trigger.dev/sdk/v3'
import { prisma } from '@/lib/prisma'
import { callClaude, buildCachedSystemPrompt } from '@/lib/claude'
import { putContent, contentKey } from '@/lib/r2'
import { hasAdequateExamples } from '@/lib/tally'
import { emailDeliveryTask } from './email-delivery'
import type { ContentType } from '@prisma/client'
import { MAX_REVISION_CYCLES, MAX_TOKENS_PER_CALL } from '@/config/pricing'

export interface ContentProductionPayload {
  clientId: string
  brief: string
  contentType: ContentType
  platformTarget: string
}

// ─── Context assembly ─────────────────────────────────────────────────────────

async function loadContext(clientId: string): Promise<{
  stable: string          // cached in Claude API — voice, audience, pillars
  dynamic: string         // not cached — recent activity, performance insights
  examples: string
  qualityStandards: string
  isDiscoveryMode: boolean
}> {
  const sections = await prisma.clientContext.findMany({
    where: { clientId },
    select: { sectionType: true, content: true },
  })

  const get = (type: string) => sections.find((s) => s.sectionType === type)?.content ?? ''

  const examples = get('EXAMPLES')
  const stable = [get('VOICE_PROFILE'), get('AUDIENCE'), get('CONTENT_PILLARS'), get('BRAND_OPINIONS')].join('\n\n')
  const dynamic = [get('RECENT_ACTIVITY'), get('PERFORMANCE_INSIGHTS')].filter(Boolean).join('\n\n')
  const qualityStandards = get('QUALITY_STANDARDS')
  const isDiscoveryMode = !hasAdequateExamples(examples)

  return { stable, dynamic, examples, qualityStandards, isDiscoveryMode }
}

// ─── Discovery Mode — 3 style variants ───────────────────────────────────────

async function runDiscoveryMode(
  brief: string,
  platformTarget: string,
  stableCtx: string,
): Promise<Array<{ label: string; draft: string }>> {
  const system = buildCachedSystemPrompt(stableCtx)

  const { text } = await callClaude({
    system,
    messages: [
      {
        role: 'user',
        content: `The client doesn't have enough writing samples yet for precise voice matching. Generate THREE style variants of the following brief. Each must be genuinely different in voice direction.

Brief: ${brief}
Platform: ${platformTarget}

Variant 1 — Direct & Opinionated: Short sentences, strong take stated immediately, no hedging, no setup.
Variant 2 — Narrative & Story-driven: Opens with a specific moment or observation, builds to the point.
Variant 3 — Educational & Structured: Walks through an idea step by step, shows the reasoning.

Respond with valid JSON only:
{
  "variants": [
    { "label": "Direct & Opinionated", "draft": "..." },
    { "label": "Narrative & Story-driven", "draft": "..." },
    { "label": "Educational & Structured", "draft": "..." }
  ]
}`,
      },
    ],
    maxTokens: 1200,
  })

  const parsed = JSON.parse(text) as { variants: Array<{ label: string; draft: string }> }
  return parsed.variants
}

// ─── Production Loop — 6 steps ────────────────────────────────────────────────

interface InternalEvalResult {
  score: number
  voiceMatch: number
  audienceFit: number
  pillarAlignment: 'pass' | 'fail'
  qualityStandard: number
  examplesMatch: number
  prohibitedPhrases: 'pass' | 'fail'
  coherence: 'pass' | 'fail'
  failingChecks: string[]
}

async function runVerification(
  draft: string,
  stableCtx: string,
  examples: string,
  qualityStandards: string,
): Promise<InternalEvalResult> {
  const system = buildCachedSystemPrompt(stableCtx)

  const { text } = await callClaude({
    system,
    messages: [
      {
        role: 'user',
        content: `You are evaluating a draft against the client's brand intelligence.

## Quality Standards
${qualityStandards}

## Approved Examples (for comparison)
${examples || 'No examples available.'}

## Draft to evaluate
${draft}

Score this draft. Respond with valid JSON only:
{
  "voiceMatch": <1-5, does this sound like the founder specifically?>,
  "audienceFit": <1-5, written for the right person at the right specificity?>,
  "pillarAlignment": <"pass" or "fail", belongs to a defined content pillar?>,
  "qualityStandard": <1-5, meets the defined standard for this content type?>,
  "examplesMatch": <1-5, consistent with or better than approved examples?>,
  "prohibitedPhrases": <"pass" or "fail", no banned phrases used?>,
  "coherence": <"pass" or "fail", no contradictions with recent activity?>,
  "failingChecks": [<list only checks that failed their threshold>]
}`,
      },
    ],
    maxTokens: 400,
  })

  const result = JSON.parse(text) as InternalEvalResult
  const avg = (result.voiceMatch + result.audienceFit + result.qualityStandard + result.examplesMatch) / 4
  result.score = Math.round(avg * 10) / 10
  return result
}

async function runProductionLoop(
  brief: string,
  platformTarget: string,
  stableCtx: string,
  dynamicCtx: string,
  examples: string,
  qualityStandards: string,
): Promise<{ draft: string; evalResult: InternalEvalResult; cycles: number }> {
  const system = buildCachedSystemPrompt(stableCtx, dynamicCtx || undefined)

  // Step 2 — Planning
  const { text: plan } = await callClaude({
    system,
    messages: [
      {
        role: 'user',
        content: `Brief: ${brief}
Platform: ${platformTarget}

Before writing, plan your approach. Output a brief planning document:
- Which content pillar and specific angle
- The single point this piece will make (exactly one)
- Who specifically in the audience you're writing for
- Structural shape and tone register
- Any recent activity signals to incorporate or avoid`,
      },
    ],
    maxTokens: 300,
  })

  // Step 3 — Execution
  const { text: initialDraft } = await callClaude({
    system,
    messages: [
      { role: 'user', content: `Brief: ${brief}\nPlatform: ${platformTarget}\n\nYour plan:\n${plan}` },
      {
        role: 'assistant',
        content: `Based on my plan, here is the ${platformTarget} content:\n\n`,
      },
    ],
    maxTokens: MAX_TOKENS_PER_CALL,
  })

  let currentDraft = initialDraft
  let cycles = 0

  // Steps 4–5 — Verification + Iteration (max 2 internal cycles)
  while (cycles < 2) {
    const evalResult = await runVerification(currentDraft, stableCtx, examples, qualityStandards)

    const passThresholds =
      evalResult.voiceMatch >= 4 &&
      evalResult.audienceFit >= 3.5 &&
      evalResult.qualityStandard >= 3.5 &&
      evalResult.examplesMatch >= 3.5 &&
      evalResult.pillarAlignment === 'pass' &&
      evalResult.prohibitedPhrases === 'pass'

    if (passThresholds) {
      return { draft: currentDraft, evalResult, cycles }
    }

    cycles++
    if (cycles >= 2) {
      return { draft: currentDraft, evalResult, cycles }
    }

    // Step 5 — Iterate on specific failures
    const { text: revisedDraft } = await callClaude({
      system,
      messages: [
        {
          role: 'user',
          content: `Your draft failed these quality checks: ${evalResult.failingChecks.join('; ')}.

Current draft:
${currentDraft}

Revise ONLY the failing elements. Do not rewrite the entire piece unless the core argument is wrong. Output the complete revised draft.`,
        },
      ],
      maxTokens: MAX_TOKENS_PER_CALL,
    })

    currentDraft = revisedDraft
  }

  const finalEval = await runVerification(currentDraft, stableCtx, examples, qualityStandards)
  return { draft: currentDraft, evalResult: finalEval, cycles }
}

// ─── Orchestrator 3-check eval (Sprint 1B simplified) ────────────────────────
// Full 8-check eval is Sprint 2. For Sprint 1B: voice match, pillar alignment, platform format.

async function runOrchestratorEval(
  draft: string,
  stableCtx: string,
  platformTarget: string,
): Promise<{ passed: boolean; holdReason?: string; failedChecks: string[] }> {
  const system = buildCachedSystemPrompt(stableCtx)

  const { text } = await callClaude({
    system,
    messages: [
      {
        role: 'user',
        content: `Run the Sprint 1B Orchestrator eval on this ${platformTarget} draft.

Draft:
${draft}

Check ONLY these three (Sprint 1B scope):
1. VOICE_MATCH — Does this sound like the founder? (pass if score ≥ 4/5)
2. PILLAR_ALIGNMENT — Does this belong to a defined content pillar? (pass/fail)
3. PLATFORM_FORMAT — Is the format correct for ${platformTarget}? Length, structure, no platform-wrong elements? (pass/fail)

Also flag if a HOLD_RECOMMENDED is appropriate:
- Would this contradict anything the founder has likely said recently?
- Does this make any claim that needs human review before publishing?

Respond with valid JSON only:
{
  "voiceMatch": <1-5>,
  "pillarAlignment": <"pass"|"fail">,
  "platformFormat": <"pass"|"fail">,
  "holdRecommended": <true|false>,
  "holdReason": <string or null>,
  "passed": <true if all three pass>,
  "failedChecks": [<list of failed check names>]
}`,
      },
    ],
    maxTokens: 300,
  })

  const result = JSON.parse(text) as {
    voiceMatch: number
    pillarAlignment: string
    platformFormat: string
    holdRecommended: boolean
    holdReason: string | null
    passed: boolean
    failedChecks: string[]
  }

  return {
    passed: result.passed && !result.holdRecommended,
    holdReason: result.holdRecommended ? (result.holdReason ?? 'Timing concern flagged by Orchestrator.') : undefined,
    failedChecks: result.failedChecks,
  }
}

// ─── Main task ─────────────────────────────────────────────────────────────────

export const contentProductionTask = task({
  id: 'content-production',
  retry: { maxAttempts: 2 },
  run: async (payload: ContentProductionPayload) => {
    const { clientId, brief, contentType, platformTarget } = payload

    logger.info('Content production started', { clientId, contentType })

    const client = await prisma.client.findUniqueOrThrow({
      where: { id: clientId },
      select: { name: true, email: true, status: true, contentActionsUsed: true, contentActionsLimit: true },
    })

    // Enforce Content Actions limit
    if (client.contentActionsUsed >= client.contentActionsLimit) {
      logger.warn('Content Actions limit reached', { clientId })
      return { status: 'limit_reached' }
    }

    const agentRun = await prisma.agentRun.create({
      data: { clientId, agentType: 'CONTENT_WRITER', status: 'running', startedAt: new Date() },
    })

    const { stable, dynamic, examples, qualityStandards, isDiscoveryMode } = await loadContext(clientId)

    let contentItem: { id: string }

    if (isDiscoveryMode) {
      logger.info('Discovery Mode triggered — insufficient examples', { clientId })

      await prisma.agentRun.update({
        where: { id: agentRun.id },
        data: { discoveryMode: true },
      })

      const variants = await runDiscoveryMode(brief, platformTarget, stable)

      // Store the discovery run as a single content item with variants embedded
      const variantText = variants.map((v) => `## ${v.label}\n\n${v.draft}`).join('\n\n---\n\n')
      const storageKey = contentKey(clientId, agentRun.id)
      await putContent(storageKey, variantText)

      contentItem = await prisma.contentItem.create({
        data: {
          clientId,
          contentType,
          status: 'DRAFT',
          storageKey,
          platformTarget,
          contentPreview: variants[0].draft.slice(0, 300),
        },
      })

      await prisma.agentRun.update({
        where: { id: agentRun.id },
        data: { status: 'completed', completedAt: new Date() },
      })

      // Deliver discovery email
      await emailDeliveryTask.trigger({
        clientId,
        contentItemId: contentItem.id,
        mode: 'discovery',
        variants,
      })

      return { status: 'discovery_mode', contentItemId: contentItem.id }
    }

    // Production Mode — full 6-step internal loop
    const { draft, evalResult, cycles } = await runProductionLoop(
      brief,
      platformTarget,
      stable,
      dynamic,
      examples,
      qualityStandards,
    )

    logger.info('Internal eval complete', { score: evalResult.score, cycles })

    await prisma.agentRun.update({
      where: { id: agentRun.id },
      data: { revisionCycles: cycles, tokenInputCount: 0, tokenOutputCount: 0 },
    })

    // Internal eval gate
    if (evalResult.score < 3.5) {
      logger.warn('Internal eval gate failed after max cycles', {
        clientId,
        score: evalResult.score,
        failingChecks: evalResult.failingChecks,
      })
      await prisma.agentRun.update({
        where: { id: agentRun.id },
        data: { status: 'escalated', errorMessage: `Internal eval score ${evalResult.score} — ${evalResult.failingChecks.join(', ')}`, completedAt: new Date() },
      })
      return { status: 'escalated', score: evalResult.score }
    }

    // Orchestrator 3-check eval (Sprint 1B)
    const orchEval = await runOrchestratorEval(draft, stable, platformTarget)

    const storageKey = contentKey(clientId, agentRun.id)
    await putContent(storageKey, draft)

    // Determine final status
    let status: 'DRAFT' | 'HOLD_RECOMMENDED' = 'DRAFT'
    let holdReason: string | undefined

    if (!orchEval.passed && orchEval.holdReason) {
      status = 'HOLD_RECOMMENDED'
      holdReason = orchEval.holdReason
    }

    contentItem = await prisma.contentItem.create({
      data: {
        clientId,
        contentType,
        status,
        storageKey,
        platformTarget,
        evalPassed: orchEval.passed,
        confidenceScore: evalResult.score * 20, // 0–100 scale
        contentPreview: draft.slice(0, 300),
        holdReason,
      },
    })

    await Promise.all([
      prisma.agentRun.update({
        where: { id: agentRun.id },
        data: { status: 'completed', completedAt: new Date() },
      }),
      // Atomic Content Actions decrement
      prisma.client.update({
        where: { id: clientId },
        data: { contentActionsUsed: { increment: 1 } },
      }),
    ])

    // Trigger email delivery
    await emailDeliveryTask.trigger({
      clientId,
      contentItemId: contentItem.id,
      mode: status === 'HOLD_RECOMMENDED' ? 'hold_recommended' : 'standard',
      holdReason,
      draftText: draft,
      contentType: contentType.toLowerCase().replace(/_/g, ' '),
      preview: draft.slice(0, 300),
    })

    return { status: 'produced', contentItemId: contentItem.id, score: evalResult.score }
  },
})
