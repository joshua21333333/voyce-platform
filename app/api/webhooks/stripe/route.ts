import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { prisma } from '@/lib/prisma'
import { getStripe } from '@/lib/stripe'
import { CONTENT_ACTIONS_BY_PLAN } from '@/config/pricing'
import { contentProductionTask } from '@/trigger/content-production'

// Sprint 1B: handles checkout completion, subscription updates, cancellation, and
// payment events. Content Actions overage billing is Sprint 3.

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

  // Idempotency via a dedicated ledger with a unique (source, eventId) constraint.
  // A duplicate delivery hits the constraint and is treated as already-processed —
  // no more fake AgentRun rows with a non-existent clientId.
  try {
    await prisma.processedWebhookEvent.create({ data: { source: 'stripe', eventId: event.id } })
  } catch {
    return NextResponse.json({ received: true, duplicate: true })
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const customerId = String(session.customer)
      const email = session.customer_details?.email?.toLowerCase() ?? session.customer_email?.toLowerCase()

      if (!email) break

      const plan = resolvePlan(session.metadata?.plan ?? 'STARTER')
      const actionsLimit = CONTENT_ACTIONS_BY_PLAN[plan] ?? 50

      const client = await prisma.client.update({
        where: { email },
        data: {
          status: 'ACTIVE',
          stripeCustomerId: customerId,
          stripeSubscriptionId: String(session.subscription ?? ''),
          plan,
          contentActionsLimit: actionsLimit,
        },
        select: { id: true, onboardingCompletedAt: true },
      }).catch(() => null)

      // Trigger the FIRST production run now that payment is confirmed. Small delay
      // lets the MCF build (fired by the Tally webhook) finish first; if it hasn't,
      // the producer falls back to Discovery Mode on thin context.
      if (client) {
        await contentProductionTask.trigger(
          {
            clientId: client.id,
            brief: "Produce a LinkedIn post on one of the client's primary content pillars.",
            contentType: 'LINKEDIN_POST',
            platformTarget: 'linkedin',
          },
          { concurrencyKey: client.id, delay: '120s' },
        )
      }
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
          plan,
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

type PlanKey = 'STARTER' | 'GROWTH' | 'PRO' | 'ENTERPRISE'

function resolvePlan(raw: string): PlanKey {
  const upper = raw.toUpperCase()
  if (upper === 'GROWTH' || upper === 'PRO' || upper === 'ENTERPRISE') return upper
  return 'STARTER'
}

function resolveStripePricePlan(sub: Stripe.Subscription): PlanKey {
  const priceId = sub.items.data[0]?.price.id ?? ''
  if (priceId === process.env.STRIPE_PRO_PRICE_ID) return 'PRO'
  if (priceId === process.env.STRIPE_GROWTH_PRICE_ID) return 'GROWTH'
  return 'STARTER'
}
