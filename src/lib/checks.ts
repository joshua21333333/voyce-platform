// Deterministic quality checks. These have objective ground truth (character counts,
// a literal banned-phrase list) so they run as pure functions BEFORE spending an LLM
// call — an LLM can neither reliably count to 280 nor exhaustively match a banned
// list. The subjective checks (voice, pillar, audience) stay as LLM calls.

export interface CheckResult {
  passed: boolean
  details?: string
}

// Character ceilings/floors per platform target. Conservative; refined in Sprint 2
// against the full platform-formats config.
const PLATFORM_LIMITS: Record<string, { max?: number; min?: number }> = {
  linkedin: { max: 3000 },
  twitter: { max: 280 },
  x: { max: 280 },
  'twitter/x': { max: 280 },
  instagram: { max: 2200 },
  facebook: { max: 5000 },
  threads: { max: 500 },
  newsletter: { min: 400 },
  long_form_article: { min: 800 },
  'long-form-article': { min: 800 },
}

export function checkPlatformFormat(text: string, platformTarget: string): CheckResult {
  const limit = PLATFORM_LIMITS[platformTarget.toLowerCase().trim()]
  if (!limit) return { passed: true }

  const len = text.trim().length
  if (limit.max && len > limit.max) {
    return { passed: false, details: `${len} characters exceeds the ${platformTarget} limit of ${limit.max}.` }
  }
  if (limit.min && len < limit.min) {
    return { passed: false, details: `${len} characters is below the ${platformTarget} minimum of ${limit.min}.` }
  }
  return { passed: true }
}

// Pulls the founder's banned vocabulary out of the assembled context. Matches the
// "Phrases never used:" / "never use" style lines the MCF assembler emits.
export function extractProhibitedPhrases(context: string): string[] {
  const phrases = new Set<string>()
  const re = /(?:phrases never used|would never use|never use[d]?|never say)\s*[:\-]?\s*([^\n]+)/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(context)) !== null) {
    for (const raw of match[1].split(/[,;|]/)) {
      const phrase = raw.replace(/[*_`"]/g, '').trim()
      if (phrase.length >= 3 && phrase.length <= 60) phrases.add(phrase)
    }
  }
  return [...phrases]
}

export function checkBoundaries(text: string, prohibitedPhrases: string[]): CheckResult {
  if (prohibitedPhrases.length === 0) return { passed: true }
  const lower = text.toLowerCase()
  const hits = prohibitedPhrases.filter((p) => lower.includes(p.toLowerCase()))
  if (hits.length > 0) {
    return { passed: false, details: `Contains prohibited phrase(s): ${hits.join('; ')}.` }
  }
  return { passed: true }
}
