import Anthropic from '@anthropic-ai/sdk'
import { MAX_CLAUDE_CALLS_PER_ACTION } from '@/config/pricing'

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: process.env.ANTHROPIC_BASE_URL,
  // SDK-level resilience: exponential backoff with jitter on 429/5xx/network errors.
  // This absorbs the Monday-morning multi-client burst at the call level so a single
  // rate-limited call does not bubble up and force a whole-task retry (which would
  // re-charge every prior call in the pipeline).
  maxRetries: 4,
})

export const MODEL = 'claude-sonnet-4-6'

export type CacheableMessage = Anthropic.MessageParam
export type TextBlock = Anthropic.TextBlockParam & {
  cache_control?: { type: 'ephemeral' }
}

// Assembles a system prompt with prompt caching on stable MCF sections.
// Stable sections (voice, audience, pillars) are marked ephemeral — 5-min cache.
// Dynamic sections (recent_activity, performance_insights) are not cached.
export function buildCachedSystemPrompt(
  stableContext: string,
  dynamicContext?: string,
): TextBlock[] {
  const blocks: TextBlock[] = [
    {
      type: 'text',
      text: stableContext,
      cache_control: { type: 'ephemeral' },
    },
  ]
  if (dynamicContext) {
    blocks.push({ type: 'text', text: dynamicContext })
  }
  return blocks
}

export interface ClaudeResult {
  text: string
  inputTokens: number
  outputTokens: number
}

export async function callClaude({
  system,
  messages,
  maxTokens = 1024,
}: {
  system: TextBlock[]
  messages: Anthropic.MessageParam[]
  maxTokens?: number
}): Promise<ClaudeResult> {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system: system as Anthropic.TextBlockParam[],
    messages,
  })

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')

  return {
    text,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  }
}

// ─── Per-action call + token budget ─────────────────────────────────────────────
// Thrown when a single production run exceeds MAX_CLAUDE_CALLS_PER_ACTION. The caller
// catches this and escalates the run instead of looping — this is the hard margin
// guardrail the cost-spiral risk requires.
export class CallBudgetExceededError extends Error {
  constructor(public readonly callCount: number) {
    super(`Claude call budget exceeded: ${callCount} > ${MAX_CLAUDE_CALLS_PER_ACTION}`)
    this.name = 'CallBudgetExceededError'
  }
}

export interface CallTracker {
  call(args: { system: TextBlock[]; messages: Anthropic.MessageParam[]; maxTokens?: number }): Promise<ClaudeResult>
  readonly totals: { inputTokens: number; outputTokens: number; calls: number }
}

// Wraps callClaude with a running tally of calls and tokens, and enforces the
// per-action call ceiling. Persist `totals` onto the AgentRun so cost-per-item is
// real (not the hardcoded 0 it used to be) and the $/item alarm can actually fire.
export function createCallTracker(): CallTracker {
  const totals = { inputTokens: 0, outputTokens: 0, calls: 0 }
  return {
    totals,
    async call(args) {
      if (totals.calls >= MAX_CLAUDE_CALLS_PER_ACTION) {
        throw new CallBudgetExceededError(totals.calls + 1)
      }
      totals.calls += 1
      const result = await callClaude(args)
      totals.inputTokens += result.inputTokens
      totals.outputTokens += result.outputTokens
      return result
    },
  }
}

// ─── Safe JSON parsing of model output ──────────────────────────────────────────
// Claude sometimes wraps JSON in ```json fences or adds a trailing note. This strips
// fences and extracts the outermost JSON object/array. Returns null on failure so the
// caller can fail the run cleanly rather than throwing and triggering a full-task
// retry that re-charges every prior call.
export function safeParseJson<T>(text: string): T | null {
  if (!text) return null
  let candidate = text.trim()

  const fence = candidate.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) candidate = fence[1].trim()

  // Fall back to the outermost {...} or [...] span if there is surrounding prose.
  if (!(candidate.startsWith('{') || candidate.startsWith('['))) {
    const firstObj = candidate.indexOf('{')
    const firstArr = candidate.indexOf('[')
    const start =
      firstObj === -1 ? firstArr : firstArr === -1 ? firstObj : Math.min(firstObj, firstArr)
    if (start === -1) return null
    const lastObj = candidate.lastIndexOf('}')
    const lastArr = candidate.lastIndexOf(']')
    const end = Math.max(lastObj, lastArr)
    if (end <= start) return null
    candidate = candidate.slice(start, end + 1)
  }

  try {
    return JSON.parse(candidate) as T
  } catch {
    return null
  }
}
