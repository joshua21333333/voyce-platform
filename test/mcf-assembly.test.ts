import { describe, it, expect } from 'vitest'
import { assembleOnboardingSections, hasAdequateExamples, readHumaniserSkill, type OnboardingResponses } from '@/lib/mcf-assembly'

const base: OnboardingResponses = {
  name: 'Jane', email: 'jane@acme.com', companyName: 'Acme',
  toneDescription: 'direct, dry, specific', writingStyle: 'short sentences',
  prohibitedPhrases: 'game-changer', primaryCustomer: 'seed founders',
  biggestFrustration: 'content takes too long', pillars: 'fundraising, hiring',
  opinions: 'most advice is generic', sample1: 'x'.repeat(250), sample2: '', sample3: '',
  activePlatforms: 'LinkedIn', publishingCadence: '2/week', qualityFloor: 'one clear point',
  plan: 'GROWTH',
}

describe('MCF assembly from onboarding', () => {
  it('assembles all required sections', () => {
    const s = assembleOnboardingSections(base)
    expect(s.VOICE_PROFILE).toContain('Acme')
    expect(s.VOICE_PROFILE).toContain('Phrases never used')
    expect(s.AUDIENCE).toContain('seed founders')
    expect(s.CONTENT_PILLARS).toContain('fundraising')
    expect(s.EXAMPLES).toContain('Sample 1')
  })

  it('hasAdequateExamples reflects sample volume', () => {
    expect(hasAdequateExamples(assembleOnboardingSections(base).EXAMPLES)).toBe(true)
    expect(hasAdequateExamples(assembleOnboardingSections({ ...base, sample1: 'tiny' }).EXAMPLES)).toBe(false)
  })
})

describe('humaniser skill reference', () => {
  it('loads the committed v3 removal-list engine', () => {
    const humaniser = readHumaniserSkill()
    // The engine is committed at agents/humaniser/humaniser-skill.md, so it must load.
    expect(humaniser).toContain('Humanizer')
    expect(humaniser).toContain('Significance inflation') // a Part-1 pattern
  })

  it('does NOT inject the reference author studies (those are study-only)', () => {
    const humaniser = readHumaniserSkill()
    // Paul Graham / literary studies live under reference/ and must not be injected;
    // only files in profiles/ are. Guards against accidental impersonation injection.
    expect(humaniser).not.toContain('Reference study — Paul Graham')
    expect(humaniser).not.toContain('literary narrative craft')
  })
})
