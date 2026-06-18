import { NextRequest, NextResponse } from 'next/server'
import { createCheckoutSession, type CheckoutPlan } from '@/lib/stripe'

const VALID_PLANS: CheckoutPlan[] = ['STARTER', 'GROWTH', 'PRO']

// Starts a Stripe subscription checkout. The client record is created PENDING by the
// Tally webhook; this is what turns PENDING into a paid, ACTIVE client. Production
// only runs once the resulting checkout.session.completed webhook fires.
export async function POST(req: NextRequest) {
  let body: { plan?: string; email?: string }
  try {
    body = (await req.json()) as { plan?: string; email?: string }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const plan = String(body.plan ?? '').toUpperCase() as CheckoutPlan
  const email = String(body.email ?? '').trim().toLowerCase()

  if (!VALID_PLANS.includes(plan)) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
  }
  if (!email) {
    return NextResponse.json({ error: 'Email required' }, { status: 400 })
  }

  try {
    const url = await createCheckoutSession({ plan, email })
    return NextResponse.json({ url })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
