// Voyce pricing tiers
// Decided 2026-06-08: raised from $40/$80/$199 to $99/$249/$499
// Rationale: original tiers produced negative or breakeven margin on Starter after
// Claude API eval-loop costs. $99 Starter gives ~87% gross margin at 50 actions.
// $249 Growth is easy B2B justification vs a $3,000 agency retainer.

export const PRICING_TIERS = {
  STARTER: {
    id: 'starter',
    name: 'Starter',
    price: 99,
    interval: 'month',
    contentActions: 50,
    description: 'For solo founders and early operators building their content presence.',
    features: [
      '50 Content Actions / month',
      'Orchestrator + Content Writer agents',
      'Voice-matched drafts via email',
      '2 revision rounds per piece',
      'Master Context File setup',
      'Content calendar dashboard',
    ],
    stripePriceId: process.env.STRIPE_STARTER_PRICE_ID ?? '',
  },
  GROWTH: {
    id: 'growth',
    name: 'Growth',
    price: 249,
    interval: 'month',
    contentActions: 150,
    description: 'For scaling founders and small teams with serious content velocity needs.',
    features: [
      '150 Content Actions / month',
      'All Starter features',
      'Full 8-check quality eval system',
      'Multi-format content (LinkedIn, newsletter, long-form)',
      'Autonomy Levels — set your trust threshold',
      '48-hour follow-up automation',
      'Buffer social publishing',
      'Beehiiv newsletter publishing',
    ],
    stripePriceId: process.env.STRIPE_GROWTH_PRICE_ID ?? '',
  },
  PRO: {
    id: 'pro',
    name: 'Pro',
    price: 499,
    interval: 'month',
    contentActions: 400,
    description: 'For growth-stage companies running a full-stack content operation.',
    features: [
      '400 Content Actions / month',
      'All Growth features',
      'SEO Specialist agent',
      'Repurposing across all formats',
      'Monthly performance reports',
      'Competitor intelligence',
      'Priority support',
    ],
    stripePriceId: process.env.STRIPE_PRO_PRICE_ID ?? '',
  },
  ENTERPRISE: {
    id: 'enterprise',
    name: 'Enterprise',
    price: null,
    interval: 'month',
    contentActions: null,
    description: 'For agencies and growth-stage companies managing multiple brands.',
    features: [
      'Unlimited Content Actions',
      'Multiple brand profiles',
      'White-label settings',
      'Team member access',
      'API access for programmatic onboarding',
      'Dedicated onboarding support',
      'SLA and custom contracts',
    ],
    stripePriceId: null,
    ctaLabel: 'Contact us',
    ctaHref: 'mailto:enterprise@voyce.ai',
  },
} as const

export type PricingTier = keyof typeof PRICING_TIERS

export const CONTENT_ACTIONS_BY_PLAN: Record<string, number | null> = {
  STARTER: 50,
  GROWTH: 150,
  PRO: 400,
  ENTERPRISE: null,
}

// ─── Content Action — the billing unit ─────────────────────────────────────────
// One Content Action = one DELIVERED content item (a draft, discovery set, or
// hold-recommended draft that reached the client). It is metered once, at the
// delivery point (see src/trigger/email-delivery.ts), independent of internal eval
// cycles. Included revision rounds redeliver the same item and are NOT re-metered.
export const CONTENT_ACTION_DEFINITION = '1 Content Action = 1 delivered content item'

// Revision rounds included per delivered item before a paid change order is required.
export const REVISION_ROUNDS_INCLUDED = 2

// Maximum Claude API revision cycles before escalating to human review.
// This is a cost and margin control — do not remove.
export const MAX_REVISION_CYCLES = 3

// Per-action token budget (hard ceiling enforced at the worker layer)
export const MAX_CLAUDE_CALLS_PER_ACTION = 10
export const MAX_TOKENS_PER_CALL = 8000

// Content Actions usage thresholds for notifications
export const USAGE_WARN_THRESHOLD = 0.8   // notify at 80% of monthly limit
export const USAGE_HARD_STOP = 1.0        // hard stop at 100%
