import { createHmac } from 'crypto'
import { readFileSync } from 'fs'
import path from 'path'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TallyWebhookPayload {
  eventId: string
  eventType: 'FORM_RESPONSE'
  createdAt: string
  data: {
    responseId: string
    submissionId: string
    respondentId: string
    formId: string
    formName: string
    createdAt: string
    fields: Array<{
      key: string    // field ID
      label: string  // human label (not stable — use key for mapping)
      type: string
      value: unknown
    }>
  }
}

interface FieldMap {
  [fieldId: string]: {
    dbColumn?: string
    mcfSection?: string
    mcfKey?: string
    required?: boolean
    hint?: string
  }
}

interface TallyFieldMapConfig {
  onboarding: { _formId: string; fields: FieldMap }
  activityUpdate: { _formId: string; fields: FieldMap }
}

// ─── Field map loader (config file, not hardcoded) ───────────────────────────

let _fieldMap: TallyFieldMapConfig | null = null

function getFieldMap(): TallyFieldMapConfig {
  if (_fieldMap) return _fieldMap
  const configPath = path.join(process.cwd(), 'config/tally-field-map.json')
  _fieldMap = JSON.parse(readFileSync(configPath, 'utf-8')) as TallyFieldMapConfig
  return _fieldMap
}

// ─── Signature verification ────────────────────────────────────────────────────

export function verifyTallySignature(
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  if (!signatureHeader) return false
  const secret = process.env.TALLY_SIGNING_SECRET
  if (!secret) return false
  const expected = createHmac('sha256', secret).update(rawBody).digest('base64')
  return expected === signatureHeader
}

// ─── Field extraction ─────────────────────────────────────────────────────────

export function extractFieldValues(
  fields: TallyWebhookPayload['data']['fields'],
  formType: 'onboarding' | 'activityUpdate',
): {
  dbFields: Record<string, string>
  mcfSections: Partial<Record<string, Record<string, string>>>
} {
  const config = getFieldMap()[formType].fields
  const dbFields: Record<string, string> = {}
  const mcfSections: Record<string, Record<string, string>> = {}

  for (const field of fields) {
    const mapping = config[field.key]
    if (!mapping) {
      // Log unknown fields — may mean form was edited
      if (process.env.NODE_ENV !== 'test') {
        console.warn(`[tally] unknown field ID "${field.key}" — update config/tally-field-map.json`)
      }
      continue
    }

    const value = Array.isArray(field.value)
      ? field.value.join(', ')
      : String(field.value ?? '').trim()

    if (mapping.dbColumn) {
      const col = mapping.dbColumn.split('.')[1]
      dbFields[col] = value
    }

    if (mapping.mcfSection && mapping.mcfKey) {
      if (!mcfSections[mapping.mcfSection]) mcfSections[mapping.mcfSection] = {}
      mcfSections[mapping.mcfSection][mapping.mcfKey] = value
    }
  }

  return { dbFields, mcfSections }
}

// ─── MCF section assembly ─────────────────────────────────────────────────────
// Turns raw field key→value pairs into formatted markdown content per section.

export function assembleVoiceProfile(fields: Record<string, string>): string {
  return [
    `## Voice Profile`,
    fields.company ? `**Company:** ${fields.company}` : null,
    fields.toneDescription ? `**Tone:** ${fields.toneDescription}` : null,
    fields.writingStyle ? `**Writing style:** ${fields.writingStyle}` : null,
    fields.prohibitedPhrases ? `**Phrases never used:** ${fields.prohibitedPhrases}` : null,
  ]
    .filter(Boolean)
    .join('\n')
}

export function assembleAudience(fields: Record<string, string>): string {
  return [
    `## Audience`,
    fields.primaryCustomer ? `**Primary customer:** ${fields.primaryCustomer}` : null,
    fields.biggestFrustration ? `**Biggest frustration:** ${fields.biggestFrustration}` : null,
  ]
    .filter(Boolean)
    .join('\n')
}

export function assembleContentPillars(fields: Record<string, string>): string {
  return [`## Content Pillars`, fields.pillars ?? ''].filter(Boolean).join('\n')
}

export function assembleBrandOpinions(fields: Record<string, string>): string {
  return [`## Brand Opinions`, fields.opinions ?? ''].filter(Boolean).join('\n')
}

export function assembleQualityStandards(fields: Record<string, string>): string {
  return [`## Quality Standards`, fields.qualityFloor ?? ''].filter(Boolean).join('\n')
}

export function assembleExamples(fields: Record<string, string>): string {
  const samples = [fields.sample1, fields.sample2, fields.sample3]
    .filter(Boolean)
    .map((s, i) => `### Sample ${i + 1}\n${s}`)
    .join('\n\n')
  return samples ? `## Writing Examples\n\n${samples}` : ''
}

export function assembleRecentActivity(fields: Record<string, string>): string {
  return [
    `## Recent Founder Activity`,
    `*Updated: ${new Date().toISOString()}*`,
    fields.recentPublishing ? `**Recent publishing:** ${fields.recentPublishing}` : null,
    fields.recentEngagements ? `**Engaging with:** ${fields.recentEngagements}` : null,
    fields.opinionsToAmplify ? `**Amplify these angles:** ${fields.opinionsToAmplify}` : null,
    fields.avoidTopics ? `**Avoid repeating:** ${fields.avoidTopics}` : null,
    fields.offLimitsTopics ? `**Off limits this period:** ${fields.offLimitsTopics}` : null,
  ]
    .filter(Boolean)
    .join('\n')
}

export function assemblePlatformConfig(fields: Record<string, string>): string {
  return [
    `## Platform Configuration`,
    fields.activePlatforms ? `**Active platforms:** ${fields.activePlatforms}` : null,
    fields.publishingCadence ? `**Publishing cadence:** ${fields.publishingCadence}` : null,
  ]
    .filter(Boolean)
    .join('\n')
}

// Returns true if the EXAMPLES section has sufficient content for voice matching.
// Threshold: at least 200 characters of real writing samples.
export function hasAdequateExamples(examplesContent: string): boolean {
  const trimmed = examplesContent.replace(/^##.*$/gm, '').trim()
  return trimmed.length >= 200
}
