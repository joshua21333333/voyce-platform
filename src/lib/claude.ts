import Anthropic from '@anthropic-ai/sdk'

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: process.env.ANTHROPIC_BASE_URL,
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

// Calls Claude with token budget enforcement.
// Throws if max_tokens would be exceeded before completing (handled by Trigger retry).
export async function callClaude({
  system,
  messages,
  maxTokens = 1024,
}: {
  system: TextBlock[]
  messages: Anthropic.MessageParam[]
  maxTokens?: number
}): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
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
