import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendPublishFailedEmail } from '@/lib/email'

// Buffer post-failure webhook. Buffer's classic webhook is unauthenticated, so we
// gate on an optional shared secret if configured. On a failure event we correlate by
// the stored Buffer update id (bufferJobId), flip the item to PUBLISH_FAILED, and
// notify the client — the highest-probability publishing incident, handled.
export async function POST(req: NextRequest) {
  const secret = process.env.BUFFER_WEBHOOK_SECRET
  if (secret && req.headers.get('x-buffer-secret') !== secret) {
    return NextResponse.json({ error: 'Invalid secret' }, { status: 401 })
  }

  let payload: {
    event?: string
    type?: string
    data?: { update_id?: string; id?: string; error?: string }
    update_id?: string
    error?: string
  }
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const eventName = (payload.event ?? payload.type ?? '').toLowerCase()
  const isFailure = eventName.includes('fail') || eventName.includes('error')
  const bufferJobId = payload.data?.update_id ?? payload.data?.id ?? payload.update_id
  const reason = payload.data?.error ?? payload.error ?? 'Buffer reported a publishing failure.'

  if (!isFailure || !bufferJobId) {
    return NextResponse.json({ received: true, ignored: true })
  }

  // Idempotency on the (jobId, event) pair.
  try {
    await prisma.processedWebhookEvent.create({
      data: { source: 'buffer', eventId: `${bufferJobId}:${eventName}` },
    })
  } catch {
    return NextResponse.json({ received: true, duplicate: true })
  }

  const item = await prisma.contentItem.findFirst({
    where: { bufferJobId },
    select: { id: true, clientId: true },
  })
  if (!item) {
    return NextResponse.json({ received: true, unmatched: true })
  }

  await prisma.contentItem.update({
    where: { id: item.id },
    data: { status: 'PUBLISH_FAILED', publishError: reason },
  })

  const client = await prisma.client.findUnique({
    where: { id: item.clientId },
    select: { name: true, email: true },
  })
  if (client) {
    await sendPublishFailedEmail({
      to: client.email,
      clientName: client.name,
      contentItemId: item.id,
      reason,
    }).catch(() => null)
  }

  return NextResponse.json({ received: true })
}
