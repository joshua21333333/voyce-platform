import { describe, it, expect } from 'vitest'
import { CONTENT_COLUMNS, columnForStatus } from '@/lib/content-columns'

describe('content board columns', () => {
  it('maps each ContentStatus to exactly one column', () => {
    const all = CONTENT_COLUMNS.flatMap((c) => c.statuses)
    // No status appears in two columns.
    expect(new Set(all).size).toBe(all.length)
  })

  it('routes statuses to the expected column', () => {
    expect(columnForStatus('DRAFT')).toBe('ongoing')
    expect(columnForStatus('REVISING')).toBe('ongoing')
    expect(columnForStatus('PUBLISHING')).toBe('ongoing')
    expect(columnForStatus('DELIVERED')).toBe('awaiting')
    expect(columnForStatus('REVISION_REQUESTED')).toBe('awaiting')
    expect(columnForStatus('HOLD_RECOMMENDED')).toBe('awaiting')
    expect(columnForStatus('APPROVED')).toBe('done')
    expect(columnForStatus('PUBLISHED')).toBe('done')
    expect(columnForStatus('ON_HOLD')).toBe('waiting')
    expect(columnForStatus('CHANGE_ORDER_REQUIRED')).toBe('waiting')
    expect(columnForStatus('PUBLISH_FAILED')).toBe('waiting')
  })

  it('falls back to ongoing for an unknown status', () => {
    expect(columnForStatus('SOME_NEW_STATUS')).toBe('ongoing')
  })
})
