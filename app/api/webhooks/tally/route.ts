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

  // Idempotency check — duplicate webhooks return 200 and do nothing
  const existing = await prisma.client.findFirst({
    where: { OR: [{ tallySubmissionId: submissionId }, { email }] },
    select: { id: true },
  })

  if (existing) {
    return NextResponse.json({ received: true, duplicate: true })
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

  // Fire MCF build job
  await mcfBuildTask.trigger({
    clientId: client.id,
    tallyData: payload.data,
  })

  return NextResponse.json({ received: true, clientId: client.id })
}
