import { task, logger } from '@trigger.dev/sdk/v3'
import { prisma } from '@/lib/prisma'
import {
  buildCachedSystemPrompt,
  createCallTracker,
  safeParseJson,
  CallBudgetExceededError,
  type CallTracker,
} from '@/lib/claude'
import { putContent, getContent, contentKey } from '@/lib/r2'
import { hasAdequateExamples, readHumaniserSkill } from '@/lib/mcf-assembly'
import { checkPlatformFormat, checkBoundaries, extractProhibitedPhrases } from '@/lib/checks'
import { alertOps } from '@/lib/alert'
import { emailDeliveryTask } from './email-delivery'
import type { ContentType } from '@prisma/client'
import { MAX_TOKENS_PER_CALL } from '@/config/pricing'

export interface ContentProductionPayload {
  clientId: string
  brief: string
  contentType: ContentType
  platformTarget: string
}

export interface RevisionProductionPayload {
  contentItemId: string
  feedback: string
}

// ─── Context assembly ─────────────────────────────────────────────────────────

interface LoadedContext {
  stable: string
  dynamic: string
  examples: string
  qualityStandards: string
  prohibitedPhrases: string[]
  isDiscoveryMode: boolean
  founderFeedback: string[] // unconsumed founder chat messages folded into this run
  humaniser: string // global writing reference, injected into writer prompts only
}

// Writer-facing system prompt: brand context + the Humanizer skill. The Humanizer is a
// specialist-level pass (it runs in the writer's loop before the Orchestrator eval), so
// it is injected here but NOT into runVerification / runOrchestratorEval, which judge
// the result and use ctx.stable alone.
function buildWriterSystem(ctx: LoadedContext) {
  const stable = ctx.humaniser ? `${ctx.stable}\n\n---\n\n${ctx.humaniser}` : ctx.stable
  return buildCachedSystemPrompt(stable, ctx.dynamic || undefined)
}

// Reads any unconsumed founder chat messages and marks them consumed in the same step,
// so the same feedback is folded into exactly one run. Returns the message bodies.
async function consumeFounderMessages(clientId: string): Promise<string[]> {
  const pending = await prisma.message.findMany({
    where: { clientId, role: 'founder', consumedAt: null },
    orderBy: { createdAt: 'asc' },
    select: { id: true, body: true },
  })
  if (pending.length === 0) return []

  await prisma.message.updateMany({
    where: { id: { in: pending.map((m) => m.id) } },
    data: { consumedAt: new Date() },
  })
  return pending.map((m) => m.body)
}

async function loadContext(clientId: string): Promise<LoadedContext> {
  const sections = await prisma.clientContext.findMany({
    where: { clientId },
    select: { sectionType: true, content: true },
  })

  const get = (type: string) => sections.find((s) => s.sectionType === type)?.content ?? ''

  const examples = get('EXAMPLES')
  const stable = [get('VOICE_PROFILE'), get('AUDIENCE'), get('CONTENT_PILLARS'), get('BRAND_OPINIONS')]
    .filter(Boolean)
    .join('\n\n')

  // Global, repo-committed writing reference. Kept separate from `stable` so it reaches
  // only the writer's prompts (via buildWriterSystem), not the eval prompts. No-ops to
  // '' when absent.
  const humaniser = readHumaniserSkill()

  // Founder chat feedback is dynamic (not cached) and incorporated as the source of
  // truth for this run, then marked consumed so it is never applied twice.
  const founderFeedback = await consumeFounderMessages(clientId)
  const founderFeedbackSection = founderFeedback.length
    ? `## Founder Feedback (incorporate this directly)\n${founderFeedback.map((f) => `- ${f}`).join('\n')}`
    : ''

  const dynamic = [get('RECENT_ACTIVITY'), get('PERFORMANCE_INSIGHTS'), founderFeedbackSection]
    .filter(Boolean)
    .join('\n\n')
  const qualityStandards = get('QUALITY_STANDARDS')
  const prohibitedPhrases = extractProhibitedPhrases(stable)
  const isDiscoveryMode = !hasAdequateExamples(examples)

  return { stable, dynamic, examples, qualityStandards, prohibitedPhrases, isDiscoveryMode, founderFeedback, humaniser }
}

// ─── Discovery Mode — 3 style variants ───────────────────────────────────────

async function runDiscoveryMode(
  tracker: CallTracker,
  brief: string,
  platformTarget: string,
  ctx: LoadedContext,
): Promise<Array<{ label: string; draft: string }> | null> {
  const system = buildWriterSystem(ctx)

  const { text } = await tracker.call({
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

  const parsed = safeParseJson<{ variants: Array<{ label: string; draft: string }> }>(text)
  if (!parsed?.variants?.length) return null
  return parsed.variants
}

// ─── Specialist internal eval (Layer 1) ──────────────────────────────────────

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
  tracker: CallTracker,
  draft: string,
  stableCtx: string,
  examples: string,
  qualityStandards: string,
): Promise<InternalEvalResult | null> {
  const system = buildCachedSystemPrompt(stableCtx)

  const { text } = await tracker.call({
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

  const result = safeParseJson<InternalEvalResult>(text)
  if (!result) return null
  const avg = (result.voiceMatch + result.audienceFit + result.qualityStandard + result.examplesMatch) / 4
  result.score = Math.round(avg * 10) / 10
  return result
}

async function runProductionLoop(
  tracker: CallTracker,
  brief: string,
  platformTarget: string,
  ctx: LoadedContext,
): Promise<{ draft: string; evalResult: InternalEvalResult | null; cycles: number }> {
  const system = buildWriterSystem(ctx)

  // Step 2 — Planning
  const { text: plan } = await tracker.call({
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
  const { text: initialDraft } = await tracker.call({
    system,
    messages: [
      { role: 'user', content: `Brief: ${brief}\nPlatform: ${platformTarget}\n\nYour plan:\n${plan}` },
      { role: 'assistant', content: `Based on my plan, here is the ${platformTarget} content:\n\n` },
    ],
    maxTokens: MAX_TOKENS_PER_CALL,
  })

  let currentDraft = initialDraft
  let cycles = 0
  let lastEval: InternalEvalResult | null = null

  // Steps 4–5 — Verification + Iteration (max 2 internal cycles)
  while (cycles < 2) {
    const evalResult = await runVerification(tracker, currentDraft, ctx.stable, ctx.examples, ctx.qualityStandards)
    lastEval = evalResult

    // Unparseable eval — stop iterating; the orchestrator gate (Layer 2) still runs.
    if (!evalResult) break

    const passThresholds =
      evalResult.voiceMatch >= 4 &&
      evalResult.audienceFit >= 3.5 &&
      evalResult.qualityStandard >= 3.5 &&
      evalResult.examplesMatch >= 3.5 &&
      evalResult.pillarAlignment === 'pass' &&
      evalResult.prohibitedPhrases === 'pass'

    if (passThresholds) return { draft: currentDraft, evalResult, cycles }

    cycles++
    if (cycles >= 2) return { draft: currentDraft, evalResult, cycles }

    // Step 5 — Iterate on specific failures
    const { text: revisedDraft } = await tracker.call({
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

  return { draft: currentDraft, evalResult: lastEval, cycles }
}

// ─── Orchestrator eval (Layer 2) — confidence source of truth ─────────────────
// Independent of the specialist's self-eval (different evaluation context). The
// confidenceScore that Autonomy Levels gate on is derived HERE, not from the writer
// grading itself. Platform-format and boundaries are deterministic and already run.

interface OrchestratorEval {
  passed: boolean
  confidenceScore: number
  holdReason?: string
  failedChecks: string[]
}

async function runOrchestratorEval(
  tracker: CallTracker,
  draft: string,
  stableCtx: string,
  platformTarget: string,
): Promise<OrchestratorEval> {
  const system = buildCachedSystemPrompt(stableCtx)

  const { text } = await tracker.call({
    system,
    messages: [
      {
        role: 'user',
        content: `Run the Orchestrator eval on this ${platformTarget} draft. Judge it independently — do not assume the writer's self-assessment is correct.

Draft:
${draft}

Check:
1. VOICE_MATCH — Does this sound like the founder? Score 1-5.
2. PILLAR_ALIGNMENT — Does this belong to a defined content pillar? pass/fail.

Also flag if a HOLD_RECOMMENDED is appropriate:
- Would this contradict anything the founder has likely said recently?
- Does this make any claim that needs human review before publishing?

Respond with valid JSON only:
{
  "voiceMatch": <1-5>,
  "pillarAlignment": <"pass"|"fail">,
  "holdRecommended": <true|false>,
  "holdReason": <string or null>
}`,
      },
    ],
    maxTokens: 250,
  })

  const result = safeParseJson<{
    voiceMatch: number
    pillarAlignment: string
    holdRecommended: boolean
    holdReason: string | null
  }>(text)

  // Unparseable orchestrator eval → fail safe to a hold so a human looks at it.
  if (!result) {
    return {
      passed: false,
      confidenceScore: 0,
      holdReason: 'Orchestrator could not evaluate this draft automatically — flagged for review.',
      failedChecks: ['ORCHESTRATOR_EVAL_PARSE'],
    }
  }

  const failedChecks: string[] = []
  if (result.voiceMatch < 4) failedChecks.push('VOICE_MATCH')
  if (result.pillarAlignment !== 'pass') failedChecks.push('PILLAR_ALIGNMENT')

  const confidenceScore = Math.round((result.voiceMatch / 5) * 100)
  const passed = failedChecks.length === 0 && !result.holdRecommended

  return {
    passed,
    confidenceScore,
    holdReason: result.holdRecommended ? (result.holdReason ?? 'Timing concern flagged by Orchestrator.') : undefined,
    failedChecks,
  }
}

// ─── Run bookkeeping ──────────────────────────────────────────────────────────

async function finalizeRun(
  agentRunId: string,
  tracker: CallTracker,
  status: 'completed' | 'failed' | 'escalated',
  extra: { revisionCycles?: number; errorMessage?: string } = {},
) {
  await prisma.agentRun.update({
    where: { id: agentRunId },
    data: {
      status,
      tokenInputCount: tracker.totals.inputTokens,
      tokenOutputCount: tracker.totals.outputTokens,
      claudeCallCount: tracker.totals.calls,
      revisionCycles: extra.revisionCycles ?? undefined,
      errorMessage: extra.errorMessage ?? undefined,
      completedAt: new Date(),
    },
  })

  // Surface non-success outcomes to ops instead of burying them in logs.
  if (status !== 'completed') {
    await alertOps(`production run ${status}`, { agentRunId, error: extra.errorMessage })
  }
}

// ─── Main task — fresh production ─────────────────────────────────────────────

export const contentProductionTask = task({
  id: 'content-production',
  queue: { name: 'content-production', concurrencyLimit: 5 },
  retry: { maxAttempts: 1 },
  run: async (payload: ContentProductionPayload) => {
    const { clientId, brief, contentType, platformTarget } = payload

    logger.info('Content production started', { clientId, contentType })

    const client = await prisma.client.findUniqueOrThrow({
      where: { id: clientId },
      select: { status: true, contentActionsUsed: true, contentActionsLimit: true },
    })

    // Hard payment gate — never spend Claude tokens for a non-active client.
    if (client.status !== 'ACTIVE') {
      logger.warn('Production blocked — client not ACTIVE', { clientId, status: client.status })
      return { status: 'not_active' }
    }

    // Action limit gate (before spending tokens).
    if (client.contentActionsUsed >= client.contentActionsLimit) {
      logger.warn('Content Actions limit reached', { clientId })
      return { status: 'limit_reached' }
    }

    const agentRun = await prisma.agentRun.create({
      data: { clientId, agentType: 'CONTENT_WRITER', status: 'running', startedAt: new Date() },
    })
    const tracker = createCallTracker()

    try {
      const ctx = await loadContext(clientId)

      // ─── Discovery Mode ───
      if (ctx.isDiscoveryMode) {
        logger.info('Discovery Mode triggered — insufficient examples', { clientId })
        await prisma.agentRun.update({ where: { id: agentRun.id }, data: { discoveryMode: true } })

        const variants = await runDiscoveryMode(tracker, brief, platformTarget, ctx)
        if (!variants) {
          await finalizeRun(agentRun.id, tracker, 'failed', { errorMessage: 'Discovery variants unparseable' })
          return { status: 'failed', reason: 'discovery_parse' }
        }

        const variantText = variants.map((v) => `## ${v.label}\n\n${v.draft}`).join('\n\n---\n\n')
        const contentItem = await prisma.contentItem.create({
          data: {
            clientId,
            contentType,
            status: 'DRAFT',
            platformTarget,
            isDiscovery: true,
            contentPreview: variants[0].draft.slice(0, 300),
          },
        })
        const storageKey = contentKey(clientId, contentItem.id, 1)
        await putContent(storageKey, variantText)
        await prisma.contentItem.update({ where: { id: contentItem.id }, data: { storageKey } })

        await finalizeRun(agentRun.id, tracker, 'completed')

        await emailDeliveryTask.trigger(
          { clientId, contentItemId: contentItem.id, mode: 'discovery', variants },
          { concurrencyKey: clientId },
        )
        return { status: 'discovery_mode', contentItemId: contentItem.id }
      }

      // ─── Production Mode ───
      const { draft, evalResult, cycles } = await runProductionLoop(tracker, brief, platformTarget, ctx)

      // Internal eval gate (Layer 1)
      if (evalResult && evalResult.score < 3.5) {
        logger.warn('Internal eval gate failed after max cycles', { clientId, score: evalResult.score })
        await finalizeRun(agentRun.id, tracker, 'escalated', {
          revisionCycles: cycles,
          errorMessage: `Internal eval score ${evalResult.score} — ${evalResult.failingChecks.join(', ')}`,
        })
        return { status: 'escalated', score: evalResult.score }
      }

      // Deterministic checks (Layer 2a) — run before the LLM orchestrator eval.
      const boundaries = checkBoundaries(draft, ctx.prohibitedPhrases)
      const format = checkPlatformFormat(draft, platformTarget)
      if (!boundaries.passed || !format.passed) {
        const reason = [boundaries.details, format.details].filter(Boolean).join(' ')
        logger.warn('Deterministic check failed — escalating', { clientId, reason })
        await finalizeRun(agentRun.id, tracker, 'escalated', {
          revisionCycles: cycles,
          errorMessage: `Deterministic check failed: ${reason}`,
        })
        return { status: 'escalated', reason }
      }

      // LLM orchestrator eval (Layer 2b) — confidence source of truth.
      const orchEval = await runOrchestratorEval(tracker, draft, ctx.stable, platformTarget)

      const item = await prisma.contentItem.create({
        data: {
          clientId,
          contentType,
          status: orchEval.holdReason ? 'HOLD_RECOMMENDED' : 'DRAFT',
          platformTarget,
          evalPassed: orchEval.passed,
          confidenceScore: orchEval.confidenceScore,
          contentPreview: draft.slice(0, 300),
          holdReason: orchEval.holdReason,
        },
      })
      const storageKey = contentKey(clientId, item.id, 1)
      await putContent(storageKey, draft)
      await prisma.contentItem.update({ where: { id: item.id }, data: { storageKey } })

      await finalizeRun(agentRun.id, tracker, 'completed', { revisionCycles: cycles })

      // Close the loop in the founder chat when this run incorporated their feedback.
      if (ctx.founderFeedback.length > 0) {
        const plural = ctx.founderFeedback.length > 1
        await prisma.message.create({
          data: {
            clientId,
            role: 'orchestrator',
            body: `Got your ${plural ? 'notes' : 'note'} — I folded ${plural ? 'them' : 'it'} into a fresh ${platformTarget} draft. It's on your board for review.`,
          },
        })
      }

      await emailDeliveryTask.trigger(
        {
          clientId,
          contentItemId: item.id,
          mode: orchEval.holdReason ? 'hold_recommended' : 'standard',
          holdReason: orchEval.holdReason,
          draftText: draft,
          contentType: contentType.toLowerCase().replace(/_/g, ' '),
          preview: draft.slice(0, 300),
        },
        { concurrencyKey: clientId },
      )

      return { status: 'produced', contentItemId: item.id, confidence: orchEval.confidenceScore }
    } catch (err) {
      if (err instanceof CallBudgetExceededError) {
        logger.error('Call budget exceeded — escalating', { clientId, calls: err.callCount })
        await finalizeRun(agentRun.id, tracker, 'escalated', { errorMessage: err.message })
        return { status: 'escalated', reason: 'call_budget' }
      }
      await finalizeRun(agentRun.id, tracker, 'failed', { errorMessage: (err as Error).message })
      throw err
    }
  },
})

// ─── Revision task — regenerates an existing item from client feedback ─────────

export const revisionProductionTask = task({
  id: 'revision-production',
  queue: { name: 'content-production', concurrencyLimit: 5 },
  retry: { maxAttempts: 1 },
  run: async ({ contentItemId, feedback }: RevisionProductionPayload) => {
    const item = await prisma.contentItem.findUniqueOrThrow({
      where: { id: contentItemId },
      select: {
        id: true, clientId: true, contentType: true, platformTarget: true,
        storageKey: true, contentPreview: true, revisionRoundsUsed: true,
      },
    })

    const client = await prisma.client.findUniqueOrThrow({
      where: { id: item.clientId },
      select: { status: true },
    })
    if (client.status !== 'ACTIVE') {
      logger.warn('Revision blocked — client not ACTIVE', { clientId: item.clientId })
      return { status: 'not_active' }
    }

    const platformTarget = item.platformTarget ?? 'linkedin'
    const ctx = await loadContext(item.clientId)

    let currentDraft = item.contentPreview ?? ''
    if (item.storageKey) {
      try { currentDraft = await getContent(item.storageKey) } catch { /* fall back to preview */ }
    }

    await prisma.contentItem.update({ where: { id: contentItemId }, data: { status: 'REVISING' } })

    const agentRun = await prisma.agentRun.create({
      data: { clientId: item.clientId, agentType: 'CONTENT_WRITER', status: 'running', startedAt: new Date() },
    })
    const tracker = createCallTracker()

    try {
      const system = buildWriterSystem(ctx)
      const { text: revised } = await tracker.call({
        system,
        messages: [
          {
            role: 'user',
            content: `The client reviewed this ${platformTarget} draft and requested a revision.

Current draft:
${currentDraft}

Client feedback (incorporate precisely — this is the source of truth):
${feedback}

Produce the complete revised draft. Keep everything the client did not ask to change.`,
          },
        ],
        maxTokens: MAX_TOKENS_PER_CALL,
      })

      // Deterministic checks on the revision.
      const boundaries = checkBoundaries(revised, ctx.prohibitedPhrases)
      const format = checkPlatformFormat(revised, platformTarget)
      const orchEval = await runOrchestratorEval(tracker, revised, ctx.stable, platformTarget)

      // v1 = original draft; revisionRoundsUsed was incremented by /api/revisions
      // before this task fired, so the first revision lands at v2.
      const storageKey = contentKey(item.clientId, item.id, item.revisionRoundsUsed + 1)
      await putContent(storageKey, revised)

      const holdReason =
        !boundaries.passed || !format.passed
          ? [boundaries.details, format.details].filter(Boolean).join(' ')
          : orchEval.holdReason

      await prisma.contentItem.update({
        where: { id: contentItemId },
        data: {
          storageKey,
          contentPreview: revised.slice(0, 300),
          evalPassed: boundaries.passed && format.passed && orchEval.passed,
          confidenceScore: orchEval.confidenceScore,
          holdReason: holdReason ?? null,
        },
      })

      await finalizeRun(agentRun.id, tracker, 'completed', { revisionCycles: 1 })

      await emailDeliveryTask.trigger(
        {
          clientId: item.clientId,
          contentItemId: item.id,
          mode: holdReason ? 'hold_recommended' : 'standard',
          holdReason: holdReason ?? undefined,
          draftText: revised,
          contentType: item.contentType.toLowerCase().replace(/_/g, ' '),
          preview: revised.slice(0, 300),
        },
        { concurrencyKey: item.clientId },
      )

      return { status: 'revised', contentItemId: item.id }
    } catch (err) {
      if (err instanceof CallBudgetExceededError) {
        await finalizeRun(agentRun.id, tracker, 'escalated', { errorMessage: err.message })
        return { status: 'escalated', reason: 'call_budget' }
      }
      await finalizeRun(agentRun.id, tracker, 'failed', { errorMessage: (err as Error).message })
      throw err
    }
  },
})
