#!/usr/bin/env tsx
/**
 * Sprint 1A — Throwaway Prototype
 *
 * Purpose: Validate the core hypothesis before building any infrastructure.
 * Question: Can the system produce a draft that sounds like this founder?
 *
 * Usage:
 *   npx tsx scripts/prototype/sprint-1a.ts
 *
 * What it does:
 *   1. Reads a founder profile from prototype/inputs/founder-profile.json
 *   2. Calls Claude API with voice context + a content brief
 *   3. Writes the draft to prototype/outputs/draft-[timestamp].md
 *   4. Optionally sends via email if RESEND_API_KEY + RECIPIENT_EMAIL are set
 *
 * Decision gate:
 *   Score each output 1–5 on: voice accuracy, audience fit, pillar relevance,
 *   factual accuracy, publishability. Average must exceed 3.5 before Sprint 1B begins.
 *
 * This script is intentionally simple. No database. No jobs. No Stripe.
 * It answers ONE question before you build anything.
 */

import Anthropic from '@anthropic-ai/sdk'
import * as fs from 'fs'
import * as path from 'path'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

interface FounderProfile {
  name: string
  company: string
  industry: string
  voiceDescription: string
  audienceDescription: string
  contentPillars: string[]
  exampleContent: Array<{ format: string; text: string }>
  prohibitedPhrases: string[]
  contentBrief: string
  targetFormat: string
}

async function runPrototype() {
  // Load founder profile
  const profilePath = path.join(__dirname, 'inputs/founder-profile.json')
  if (!fs.existsSync(profilePath)) {
    console.error(`
Missing: scripts/prototype/inputs/founder-profile.json

Create this file with the following structure and re-run:

{
  "name": "Founder Name",
  "company": "Company Name",
  "industry": "Industry",
  "voiceDescription": "Describe their voice in 3–5 sentences. Be specific — rhythm, sentence length, topics.",
  "audienceDescription": "Who they write for. Be specific about job title, frustrations, what a win looks like.",
  "contentPillars": ["Pillar 1", "Pillar 2", "Pillar 3"],
  "exampleContent": [
    { "format": "linkedin", "text": "Paste a real post here..." },
    { "format": "newsletter", "text": "Paste a real newsletter excerpt here..." }
  ],
  "prohibitedPhrases": ["game-changer", "in today's world", "let's dive in"],
  "contentBrief": "Write a LinkedIn post about [specific topic] from this founder's perspective.",
  "targetFormat": "linkedin"
}
`)
    process.exit(1)
  }

  const profile: FounderProfile = JSON.parse(fs.readFileSync(profilePath, 'utf-8'))

  console.log(`\nRunning Sprint 1A prototype for: ${profile.name} at ${profile.company}`)
  console.log(`Target format: ${profile.targetFormat}`)
  console.log(`Brief: ${profile.contentBrief}\n`)

  // Assemble context (simulates what the database-backed MCF will do in Sprint 1B)
  const examplesText = profile.exampleContent
    .map((ex, i) => `Example ${i + 1} (${ex.format}):\n${ex.text}`)
    .join('\n\n---\n\n')

  const systemPrompt = `You are producing content for ${profile.name}, founder of ${profile.company}.

## Who they are
${profile.voiceDescription}

## Their audience
${profile.audienceDescription}

## Content pillars
${profile.contentPillars.join(', ')}

## Phrases they never use
${profile.prohibitedPhrases.join(', ')}

## Their actual writing (study these carefully — match the rhythm, not the topic)
${examplesText}

## Your task
Produce one piece of content that sounds like ${profile.name} on their best day. Not their average day — their best day, when they are most clear, most specific, and most themselves.

Quality floor:
- Make one clear point well
- Open in a way that earns the reader's attention immediately
- No filler phrases, no generic AI language, no motivational openers
- End cleanly
- If it could have been written by anyone else, it is not good enough`

  const userPrompt = `Content brief: ${profile.contentBrief}

Format: ${profile.targetFormat}

Write the content now. Output only the final piece — no preamble, no meta-commentary.`

  console.log('Calling Claude API...')
  const start = Date.now()

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  const outputText = response.content[0].type === 'text' ? response.content[0].text : ''

  console.log(`Done in ${elapsed}s. Input tokens: ${response.usage.input_tokens}, Output tokens: ${response.usage.output_tokens}\n`)
  console.log('─'.repeat(60))
  console.log(outputText)
  console.log('─'.repeat(60))

  // Write output to file
  const outputDir = path.join(__dirname, 'outputs')
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const outputPath = path.join(outputDir, `draft-${timestamp}.md`)

  const outputContent = `# Sprint 1A Draft
**Client:** ${profile.name} / ${profile.company}
**Format:** ${profile.targetFormat}
**Brief:** ${profile.contentBrief}
**Model:** ${response.model}
**Input tokens:** ${response.usage.input_tokens}
**Output tokens:** ${response.usage.output_tokens}
**Generated:** ${new Date().toISOString()}

---

${outputText}

---

## Evaluation (fill in manually)

Voice accuracy (1–5):
Audience fit (1–5):
Pillar relevance (1–5):
Factual accuracy (1–5):
Publishability (1–5):
Average:

Notes:
`

  fs.writeFileSync(outputPath, outputContent)
  console.log(`\nDraft saved to: ${outputPath}`)

  // Optional email delivery
  if (process.env.RESEND_API_KEY && process.env.PROTOTYPE_RECIPIENT_EMAIL) {
    const { Resend } = await import('resend')
    const resend = new Resend(process.env.RESEND_API_KEY)

    await resend.emails.send({
      from: process.env.EMAIL_FROM ?? 'prototype@voyce.ai',
      to: process.env.PROTOTYPE_RECIPIENT_EMAIL,
      subject: `[Sprint 1A] Draft for ${profile.name} — ${profile.targetFormat}`,
      text: `Sprint 1A prototype draft for ${profile.name}.\n\nBrief: ${profile.contentBrief}\n\n---\n\n${outputText}\n\n---\n\nPlease rate this draft 1–5 on:\n- Voice accuracy (does this sound like you?)\n- Audience fit\n- Pillar relevance\n- Factual accuracy\n- Publishability (would you publish this as-is?)\n\nReply with your scores. Target average: 3.5+`,
    })

    console.log(`Draft emailed to: ${process.env.PROTOTYPE_RECIPIENT_EMAIL}`)
  } else {
    console.log('\nTo email the draft: set RESEND_API_KEY and PROTOTYPE_RECIPIENT_EMAIL in your environment')
  }

  console.log(`
─────────────────────────────────────────────────
Sprint 1A Decision Gate
─────────────────────────────────────────────────
Score this draft 1–5 on:
  • Voice accuracy   (does it sound like the founder?)
  • Audience fit     (right person, right level?)
  • Pillar relevance (serves a defined pillar?)
  • Factual accuracy (no fabricated claims?)
  • Publishability   (would they publish this as-is?)

Fill in the output file at: ${outputPath}

Target: average score ≥ 3.5 across all dimensions
        AND across at least 5 founder profiles.

Below 3.5 → diagnose voice-matching problems BEFORE building Sprint 1B.
Above 3.5 → proceed to Sprint 1B infrastructure build.
─────────────────────────────────────────────────
`)
}

runPrototype().catch((err) => {
  console.error('Prototype failed:', err)
  process.exit(1)
})
