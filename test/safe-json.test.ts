import { describe, it, expect } from 'vitest'
import { safeParseJson } from '@/lib/claude'

describe('safeParseJson (model output resilience)', () => {
  it('parses plain JSON', () => {
    expect(safeParseJson<{ a: number }>('{"a":1}')).toEqual({ a: 1 })
  })

  it('parses ```json fenced output', () => {
    expect(safeParseJson<{ ok: boolean }>('```json\n{"ok":true}\n```')).toEqual({ ok: true })
  })

  it('extracts JSON wrapped in prose', () => {
    expect(safeParseJson<{ x: number }>('Here is the result: {"x":5} — hope that helps')).toEqual({ x: 5 })
  })

  it('returns null on unparseable output (no throw)', () => {
    expect(safeParseJson('not json at all')).toBeNull()
    expect(safeParseJson('')).toBeNull()
  })
})
