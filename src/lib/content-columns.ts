// Maps ContentItem.status → the four board columns founders scan: what's in flight,
// what needs them, what's done, and what's stuck waiting. Shared by the Drafts kanban
// (app/(dashboard)/drafts) and the dashboard task summary so the two never drift.

export type ColumnKey = 'ongoing' | 'awaiting' | 'done' | 'waiting'

export interface Column {
  key: ColumnKey
  label: string
  hint: string
  accent: string // header accent color
  statuses: string[]
}

export const CONTENT_COLUMNS: Column[] = [
  {
    key: 'ongoing',
    label: 'Ongoing',
    hint: 'Voyce is working on these',
    accent: '#4b9eff',
    statuses: ['DRAFT', 'REVISING', 'PUBLISHING'],
  },
  {
    key: 'awaiting',
    label: 'Awaiting approval',
    hint: 'Need your review',
    accent: '#f59e0b',
    statuses: ['DELIVERED', 'REVISION_REQUESTED', 'HOLD_RECOMMENDED'],
  },
  {
    key: 'done',
    label: 'Done',
    hint: 'Approved & published',
    accent: '#34d399',
    statuses: ['APPROVED', 'PUBLISHED'],
  },
  {
    key: 'waiting',
    label: 'Waiting',
    hint: 'Held or blocked',
    accent: '#6b7280',
    statuses: ['ON_HOLD', 'CHANGE_ORDER_REQUIRED', 'PUBLISH_FAILED'],
  },
]

const STATUS_TO_COLUMN: Record<string, ColumnKey> = Object.fromEntries(
  CONTENT_COLUMNS.flatMap((col) => col.statuses.map((s) => [s, col.key])),
)

// Falls back to 'ongoing' for any status not explicitly mapped (e.g. a new enum value).
export function columnForStatus(status: string): ColumnKey {
  return STATUS_TO_COLUMN[status] ?? 'ongoing'
}
