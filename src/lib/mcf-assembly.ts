// MCF assembly from native onboarding responses. Replaces the Tally webhook +
// field-map layer: the onboarding form posts typed fields directly, so there is no
// brittle field-ID mapping. These functions turn typed responses into the markdown
// section content stored per ClientContext row.

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

export type OnboardingPlan = 'STARTER' | 'GROWTH' | 'PRO'

export interface OnboardingResponses {
  name: string
  email: string
  companyName: string
  // Voice
  toneDescription: string
  writingStyle: string
  prohibitedPhrases: string
  // Audience
  primaryCustomer: string
  biggestFrustration: string
  // Strategy
  pillars: string
  opinions: string
  // Examples (sample1 required; 2/3 optional)
  sample1: string
  sample2?: string
  sample3?: string
  // Platform
  activePlatforms: string
  publishingCadence: string
  // Quality (optional)
  qualityFloor?: string
  // Plan selected at signup
  plan: OnboardingPlan
}

export interface ActivityResponses {
  recentPublishing?: string
  recentEngagements?: string
  opinionsToAmplify?: string
  avoidTopics?: string
  offLimitsTopics?: string
}

// Section types written by onboarding (mirrors ContextSectionType).
export type AssembledSections = {
  VOICE_PROFILE: string
  AUDIENCE: string
  CONTENT_PILLARS: string
  BRAND_OPINIONS: string
  QUALITY_STANDARDS: string
  EXAMPLES: string
  PLATFORM_CONFIG: string
}

function assembleVoiceProfile(r: OnboardingResponses): string {
  return [
    `## Voice Profile`,
    r.companyName ? `**Company:** ${r.companyName}` : null,
    r.toneDescription ? `**Tone:** ${r.toneDescription}` : null,
    r.writingStyle ? `**Writing style:** ${r.writingStyle}` : null,
    r.prohibitedPhrases ? `**Phrases never used:** ${r.prohibitedPhrases}` : null,
  ]
    .filter(Boolean)
    .join('\n')
}

function assembleAudience(r: OnboardingResponses): string {
  return [
    `## Audience`,
    r.primaryCustomer ? `**Primary customer:** ${r.primaryCustomer}` : null,
    r.biggestFrustration ? `**Biggest frustration:** ${r.biggestFrustration}` : null,
  ]
    .filter(Boolean)
    .join('\n')
}

function assembleContentPillars(r: OnboardingResponses): string {
  return [`## Content Pillars`, r.pillars ?? ''].filter(Boolean).join('\n')
}

function assembleBrandOpinions(r: OnboardingResponses): string {
  return [`## Brand Opinions`, r.opinions ?? ''].filter(Boolean).join('\n')
}

function assembleQualityStandards(r: OnboardingResponses): string {
  return [`## Quality Standards`, r.qualityFloor ?? ''].filter(Boolean).join('\n')
}

function assembleExamples(r: OnboardingResponses): string {
  const samples = [r.sample1, r.sample2, r.sample3]
    .filter((s): s is string => Boolean(s && s.trim()))
    .map((s, i) => `### Sample ${i + 1}\n${s}`)
    .join('\n\n')
  return samples ? `## Writing Examples\n\n${samples}` : ''
}

function assemblePlatformConfig(r: OnboardingResponses): string {
  return [
    `## Platform Configuration`,
    r.activePlatforms ? `**Active platforms:** ${r.activePlatforms}` : null,
    r.publishingCadence ? `**Publishing cadence:** ${r.publishingCadence}` : null,
  ]
    .filter(Boolean)
    .join('\n')
}

export function assembleOnboardingSections(r: OnboardingResponses): AssembledSections {
  return {
    VOICE_PROFILE: assembleVoiceProfile(r),
    AUDIENCE: assembleAudience(r),
    CONTENT_PILLARS: assembleContentPillars(r),
    BRAND_OPINIONS: assembleBrandOpinions(r),
    QUALITY_STANDARDS: assembleQualityStandards(r),
    EXAMPLES: assembleExamples(r),
    PLATFORM_CONFIG: assemblePlatformConfig(r),
  }
}

export function assembleRecentActivity(r: ActivityResponses, now: string): string {
  return [
    `## Recent Founder Activity`,
    `*Updated: ${now}*`,
    r.recentPublishing ? `**Recent publishing:** ${r.recentPublishing}` : null,
    r.recentEngagements ? `**Engaging with:** ${r.recentEngagements}` : null,
    r.opinionsToAmplify ? `**Amplify these angles:** ${r.opinionsToAmplify}` : null,
    r.avoidTopics ? `**Avoid repeating:** ${r.avoidTopics}` : null,
    r.offLimitsTopics ? `**Off limits this period:** ${r.offLimitsTopics}` : null,
  ]
    .filter(Boolean)
    .join('\n')
}

// ─── Humaniser skill (global writing reference) ──────────────────────────────
// A repo-committed reference that strips AI-writing tells from output. It is the same
// for every client (unlike the per-client voice_profile), so it is read from disk at
// assembly time rather than stored per-row. It is injected only into the writer's
// drafting/revision prompts (see content-production.ts), never the eval prompts — the
// Humanizer is a specialist-level pass that runs before the Orchestrator's eval.
//
// Layout (see agents/humaniser/README.md):
//   humaniser-skill.md  → the engine (44-pattern removal list). Always injected.
//   profiles/*.md       → opt-in. Anything dropped here is injected too.
//   reference/, samples/ → studied craft library, deliberately NOT injected.
//
// Everything no-ops gracefully (returns '') if absent, so the build never breaks.

// Core skill, first match wins. Includes the legacy single-file locations so an older
// drop still works.
const HUMANISER_SKILL_FILES = [
  'agents/humaniser/humaniser-skill.md',
  'agents/humaniser-skill.md',
  'agents/humaniser skill.md',
]
const HUMANISER_PROFILES_DIR = 'agents/humaniser/profiles'

// Cached after first read (including the not-found case) to avoid touching disk on
// every production run. `undefined` = not yet attempted.
let humaniserCache: string | undefined

function readRepoFile(rel: string): string | null {
  try {
    // turbopackIgnore: the path is rooted at the project cwd at runtime — don't let the
    // file tracer follow it and pull the whole project into the bundle.
    return readFileSync(join(/* turbopackIgnore: true */ process.cwd(), rel), 'utf8').trim()
  } catch {
    return null
  }
}

export function readHumaniserSkill(): string {
  if (humaniserCache !== undefined) return humaniserCache

  const parts: string[] = []

  // 1. The core removal-list engine.
  for (const rel of HUMANISER_SKILL_FILES) {
    const content = readRepoFile(rel)
    if (content) {
      parts.push(content)
      break
    }
  }

  // 2. Opt-in reference profiles — any .md in profiles/ is injected too. (Author
  //    studies in reference/ are intentionally not read here.)
  try {
    const dir = join(/* turbopackIgnore: true */ process.cwd(), HUMANISER_PROFILES_DIR)
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.md')).sort()) {
      const content = readRepoFile(`${HUMANISER_PROFILES_DIR}/${file}`)
      if (content) parts.push(content)
    }
  } catch {
    // No profiles directory — fine.
  }

  humaniserCache = parts.join('\n\n---\n\n')
  return humaniserCache
}

// True if the EXAMPLES section has enough real writing for voice matching.
// Threshold: at least 200 characters of samples (headings stripped).
export function hasAdequateExamples(examplesContent: string): boolean {
  const trimmed = examplesContent.replace(/^##.*$/gm, '').replace(/^###.*$/gm, '').trim()
  return trimmed.length >= 200
}
