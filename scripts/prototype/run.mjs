#!/usr/bin/env node
// Sprint 1A — self-contained prototype (no npm deps required)
// Uses Node 18+ built-in fetch to call Anthropic API directly.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const profilePath = join(__dirname, 'inputs/founder-profile.json')
const profile = JSON.parse(readFileSync(profilePath, 'utf-8'))

const examplesText = profile.exampleContent
  .filter(ex => !ex.text.startsWith('No examples provided'))
  .map((ex, i) => `Example ${i + 1} (${ex.format}):\n${ex.text}`)
  .join('\n\n---\n\n')

const hasRealExamples = examplesText.length > 0

const systemPrompt = `You are producing content for the founder of ${profile.company}, a ${profile.industry} business.

## Voice
${profile.voiceDescription}

## Audience
${profile.audienceDescription}

## Content pillars
${profile.contentPillars.join('\n')}

## Phrases never used
${profile.prohibitedPhrases.join(', ')}

${hasRealExamples ? `## Writing samples (study these — match the rhythm, not the topic)\n${examplesText}` : `## Note: No writing samples provided
Voice matching must rely on the voice description above. This is the critical gap the prototype will expose — without real writing samples, the system is inferring voice from a description rather than matching from evidence. The output will demonstrate whether description alone is sufficient.`}

## Your standard
Produce content that sounds like this founder on their best day. Not average, best — most clear, most direct, most specific, most themselves.

Quality floor:
- Make one clear point
- First sentence must earn attention immediately — not with a question, not with a statistic, not with "Most companies..."
- No filler. No hedge words. No conclusions that say what you just said.
- End on something that lands, not a summary
- If another content agency could have written this, it fails`

const userPrompt = `Brief: ${profile.contentBrief}
Format: ${profile.targetFormat} post
Output only the post — nothing else.`

console.log(`\nSprint 1A — Ink & Impact prototype run`)
console.log(`Brief: ${profile.contentBrief}`)
console.log(`Writing samples: ${hasRealExamples ? profile.exampleContent.length : 'NONE — voice matching from description only'}`)
console.log('\nCalling Claude API...\n')

const start = Date.now()

const baseUrl = process.env.ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com'
const res = await fetch(`${baseUrl}/v1/messages`, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-api-key': process.env.ANTHROPIC_API_KEY,
    'anthropic-version': '2023-06-01',
  },
  body: JSON.stringify({
    model: 'claude-sonnet-4-6',
    max_tokens: 600,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  }),
})

const data = await res.json()

if (!res.ok) {
  console.error('API error:', data)
  process.exit(1)
}

const elapsed = ((Date.now() - start) / 1000).toFixed(1)
const draft = data.content[0].text

console.log('─'.repeat(60))
console.log(draft)
console.log('─'.repeat(60))
console.log(`\n${elapsed}s | input: ${data.usage.input_tokens} tokens | output: ${data.usage.output_tokens} tokens`)

// Save output
const outputDir = join(__dirname, 'outputs')
if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true })

const ts = new Date().toISOString().replace(/[:.]/g, '-')
const outputPath = join(outputDir, `draft-${ts}.md`)

writeFileSync(outputPath, `# Sprint 1A Draft — Ink & Impact
**Brief:** ${profile.contentBrief}
**Model:** ${data.model}
**Tokens:** ${data.usage.input_tokens} in / ${data.usage.output_tokens} out
**Writing samples provided:** ${hasRealExamples ? profile.exampleContent.length : 'NONE'}
**Generated:** ${new Date().toISOString()}

---

${draft}

---

## Eval Grid

| Dimension | Score (1–5) | Notes |
|---|---|---|
| Voice accuracy — sounds like the founder? | | |
| Audience fit — right person, right level? | | |
| Pillar relevance — serves a defined pillar? | | |
| Factual accuracy — no fabricated claims? | | |
| Publishability — would publish as-is? | | |
| **Average** | | |

**Decision gate:** average ≥ 3.5 across 5 founder profiles → proceed to Sprint 1B
`)

console.log(`\nSaved: ${outputPath}`)

if (!hasRealExamples) {
  console.log(`
⚠️  PROTOTYPE DIAGNOSTIC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
No writing samples were provided.
The adversarial challenge predicted this: the problem is
not the AI — it's the onboarding form. Voice matching from
a description alone will produce competent but generic output.
Real samples are what makes this specific.

To run with samples: add real LinkedIn posts, newsletter
excerpts, or articles to exampleContent in founder-profile.json
and re-run. The difference in output quality will be the data
point that justifies the MCF design.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`)
}
