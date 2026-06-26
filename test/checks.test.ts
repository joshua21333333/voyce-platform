import { describe, it, expect } from 'vitest'
import { checkPlatformFormat, checkBoundaries, extractProhibitedPhrases } from '@/lib/checks'

describe('deterministic platform format check', () => {
  it('fails an over-length tweet', () => {
    const res = checkPlatformFormat('a'.repeat(300), 'twitter')
    expect(res.passed).toBe(false)
    expect(res.details).toContain('280')
  })

  it('passes an in-limit tweet', () => {
    expect(checkPlatformFormat('short and sweet', 'twitter').passed).toBe(true)
  })

  it('fails a too-short newsletter', () => {
    expect(checkPlatformFormat('too short', 'newsletter').passed).toBe(false)
  })

  it('passes unknown platforms (no constraint)', () => {
    expect(checkPlatformFormat('anything', 'carrier-pigeon').passed).toBe(true)
  })
})

describe('deterministic boundaries check', () => {
  it('flags a prohibited phrase', () => {
    const res = checkBoundaries('In today’s world we must synergize', ['in today’s world'])
    expect(res.passed).toBe(false)
  })

  it('passes clean copy', () => {
    expect(checkBoundaries('A specific, grounded sentence.', ['game-changer']).passed).toBe(true)
  })

  it('passes when there are no prohibited phrases', () => {
    expect(checkBoundaries('anything', []).passed).toBe(true)
  })
})

describe('prohibited phrase extraction', () => {
  it('pulls phrases from a voice profile block', () => {
    const ctx = '## Voice Profile\n**Phrases never used:** game-changer, synergy, leverage'
    const phrases = extractProhibitedPhrases(ctx)
    expect(phrases).toContain('game-changer')
    expect(phrases).toContain('synergy')
  })
})
