import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { createCheckoutSession } from '@/lib/stripe'

// Native onboarding intake — replaces the Tally form + webhook. Posts typed fields,
// validated here, stored on the client as the source of truth for the MCF build.
// No Claude calls happen here; the MCF build (and first production) only run after
// payment via the Stripe checkout this route returns.
const OnboardingSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Valid email is required'),
  companyName: z.string().min(1, 'Company is required'),
  toneDescription: z.string().min(1),
  writingStyle: z.string().min(1),
  prohibitedPhrases: z.string().default(''),
  primaryCustomer: z.string().min(1),
  biggestFrustration: z.string().min(1),
  pillars: z.string().min(1),
  opinions: z.string().default(''),
  sample1: z.string().min(80, 'Please paste at least one real writing sample'),
  sample2: z.string().optional().default(''),
  sample3: z.string().optional().default(''),
  activePlatforms: z.string().min(1),
  publishingCadence: z.string().min(1),
  qualityFloor: z.string().optional().default(''),
  plan: z.enum(['STARTER', 'GROWTH', 'PRO']),
})

export async function POST(req: NextRequest) {
  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = OnboardingSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    )
  }

  const data = parsed.data
  const email = data.email.toLowerCase().trim()
  const responses = JSON.stringify({ ...data, email })

  // Upsert by email so re-onboarding updates one record rather than creating dupes.
  const client = await prisma.client.upsert({
    where: { email },
    update: { name: data.name, companyName: data.companyName, onboardingResponses: responses },
    create: {
      email,
      name: data.name,
      companyName: data.companyName,
      status: 'PENDING',
      onboardingResponses: responses,
    },
    select: { id: true },
  })

  try {
    const checkoutUrl = await createCheckoutSession({ plan: data.plan, email })
    return NextResponse.json({ ok: true, clientId: client.id, checkoutUrl })
  } catch (err) {
    // Onboarding saved even if checkout creation fails (e.g. price IDs not set yet).
    return NextResponse.json(
      { ok: true, clientId: client.id, checkoutUrl: null, warning: (err as Error).message },
      { status: 200 },
    )
  }
}
