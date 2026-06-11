import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { prisma } from '@/lib/prisma'
import { CONTENT_ACTIONS_BY_PLAN } from '@/config/pricing'

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key || key === 'NEEDS_EXTERNAL_SETUP') throw new Error('STRIPE_SECRET_KEY not configured')
  return new Stripe(key)
}

// Sprint 1B: handles checkout completion, subscription updates, cancellation, and payment events.
// Content Actions metering (overage billing) is Sprint 3.

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET ?? '')
  } catch {
    return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 })
  }

  // Idempotency: skip already-processed events
  const eventId = event.id
  const seen = await prisma.agentRun.findFirst({ where: { triggerJobId: `stripe-${eventId}` } })
  if (seen) return NextResponse.json({ received: true, duplicate: true })

  // Record that we're processing this event
  await prisma.agentRun.create({
    data: { clientId: 'system', agentType: 'ORCHESTRATOR', triggerJobId: `stripe-${eventId}`, status: 'completed', startedAt: new Date(), completedAt: new Date() },
  }).catch(() => null) // non-blocking, best-effort idempotency marker

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const customerId = String(session.customer)
      const email = session.customer_details?.email?.toLowerCase()

      if (!email) break

      const plan = resolvePlan(session.metadata?.plan ?? 'STARTER')
      const actionsLimit = CONTENT_ACTIONS_BY_PLAN[plan] ?? 50

      await prisma.client.update({
        where: { email },
        data: {
          status: 'ACTIVE',
          stripeCustomerId: customerId,
          stripeSubscriptionId: String(session.subscription ?? ''),
          plan: plan as any,
          contentActionsLimit: actionsLimit,
        },
      })
      break
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      const customerId = String(sub.customer)
      const plan = resolveStripePricePlan(sub)
      const actionsLimit = CONTENT_ACTIONS_BY_PLAN[plan] ?? 50

      await prisma.client.updateMany({
        where: { stripeCustomerId: customerId },
        data: {
          plan: plan as any,
          contentActionsLimit: actionsLimit,
          currentPeriodStart: new Date(sub.current_period_start * 1000),
          currentPeriodEnd: new Date(sub.current_period_end * 1000),
        },
      })
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      await prisma.client.updateMany({
        where: { stripeCustomerId: String(sub.customer) },
        data: { status: 'CANCELLED' },
      })
      break
    }

    case 'invoice.payment_succeeded': {
      // Reset monthly Content Actions counter on successful renewal
      const invoice = event.data.object as Stripe.Invoice
      await prisma.client.updateMany({
        where: { stripeCustomerId: String(invoice.customer) },
        data: { contentActionsUsed: 0 },
      })
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      await prisma.client.updateMany({
        where: { stripeCustomerId: String(invoice.customer) },
        data: { status: 'SUSPENDED' },
      })
      break
    }

    default:
      break
  }

  return NextResponse.json({ received: true })
}

function resolvePlan(raw: string): keyof typeof CONTENT_ACTIONS_BY_PLAN {
  const upper = raw.toUpperCase()
  if (['STARTER', 'GROWTH', 'PRO', 'ENTERPRISE'].includes(upper)) return upper as any
  return 'STARTER'
}

function resolveStripePricePlan(sub: Stripe.Subscription): string {
  const priceId = sub.items.data[0]?.price.id ?? ''
  if (priceId === process.env.STRIPE_PRO_PRICE_ID) return 'PRO'
  if (priceId === process.env.STRIPE_GROWTH_PRICE_ID) return 'GROWTH'
  return 'STARTER'
}
