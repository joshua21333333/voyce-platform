import Stripe from 'stripe'
import { PRICING_TIERS } from '@/config/pricing'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key || key === 'NEEDS_EXTERNAL_SETUP') throw new Error('STRIPE_SECRET_KEY not configured')
  return new Stripe(key)
}

export type CheckoutPlan = 'STARTER' | 'GROWTH' | 'PRO'

// Creates a Stripe-hosted subscription checkout. The plan is stamped into both the
// session and subscription metadata so the webhook can resolve the tier reliably.
export async function createCheckoutSession({
  plan,
  email,
}: {
  plan: CheckoutPlan
  email: string
}): Promise<string> {
  const tier = PRICING_TIERS[plan]
  const priceId = tier.stripePriceId
  if (!priceId) {
    throw new Error(`No Stripe price ID configured for plan ${plan} (set STRIPE_${plan}_PRICE_ID)`)
  }

  const session = await getStripe().checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    customer_email: email,
    metadata: { plan },
    subscription_data: { metadata: { plan } },
    success_url: `${APP_URL}/login/check-email?checkout=success`,
    cancel_url: `${APP_URL}/?checkout=cancelled`,
  })

  if (!session.url) throw new Error('Stripe did not return a checkout URL')
  return session.url
}
