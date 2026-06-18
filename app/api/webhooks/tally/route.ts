import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyTallySignature, type TallyWebhookPayload } from '@/lib/tally'
import { mcfBuildTask } from '@/trigger/mcf-build'

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('tally-signature')

  if (!verifyTallySignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let payload: TallyWebhookPayload
  try {
    payload = JSON.parse(rawBody) as TallyWebhookPayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { submissionId, fields } = payload.data

  // Extract email and name for idempotency check + record creation
  const emailField = fields.find(
    (f) => f.type === 'INPUT_EMAIL' || f.label?.toLowerCase().includes('email'),
  )
  const email = String(emailField?.value ?? '').trim().toLowerCase()

  if (!email) {
    return NextResponse.json({ error: 'No email in submission' }, { status: 400 })
  }

  // True idempotency: the SAME submission delivered twice is a no-op. Keyed on
  // submissionId alone so a returning client's distinct second submission is not
  // silently dropped.
  const dupSubmission = await prisma.client.findUnique({
    where: { tallySubmissionId: submissionId },
    select: { id: true },
  })
  if (dupSubmission) {
    return NextResponse.json({ received: true, duplicate: true })
  }

  // Email collision: a client with this email already exists (re-onboarding). Keep a
  // single record — point it at the new submission and rebuild the MCF from it.
  const existingEmail = await prisma.client.findUnique({
    where: { email },
    select: { id: true },
  })
  if (existingEmail) {
    await prisma.client.update({
      where: { id: existingEmail.id },
      data: { tallySubmissionId: submissionId },
    })
    await mcfBuildTask.trigger({ clientId: existingEmail.id, tallyData: payload.data })
    return NextResponse.json({ received: true, reonboarded: true, clientId: existingEmail.id })
  }

  // Create client record (status PENDING until Stripe payment)
  const client = await prisma.client.create({
    data: {
      email,
      name: email.split('@')[0], // placeholder until MCF build extracts real name
      tallySubmissionId: submissionId,
      status: 'PENDING',
    },
  })

  // Fire MCF build job (production does NOT start until payment is confirmed)
  await mcfBuildTask.trigger({
    clientId: client.id,
    tallyData: payload.data,
  })

  return NextResponse.json({ received: true, clientId: client.id })
}
