import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { revisionProductionTask } from '@/trigger/content-production'
import { REVISION_ROUNDS_INCLUDED } from '@/config/pricing'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { contentItemId, notes } = (await req.json()) as { contentItemId: string; notes: string }
  if (!contentItemId || !notes?.trim()) {
    return NextResponse.json({ error: 'contentItemId and notes required' }, { status: 400 })
  }

  const client = await prisma.client.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  })
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const item = await prisma.contentItem.findUnique({
    where: { id: contentItemId, clientId: client.id },
    select: { id: true, status: true, revisionRoundsUsed: true },
  })
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Enforce included revision rounds. The (N+1)th request converts to a change order
  // instead of producing another free revision.
  if (item.revisionRoundsUsed >= REVISION_ROUNDS_INCLUDED) {
    await prisma.contentItem.update({
      where: { id: contentItemId },
      data: { status: 'CHANGE_ORDER_REQUIRED' },
    })
    return NextResponse.json({
      ok: false,
      changeOrder: true,
      message: `This piece has used its ${REVISION_ROUNDS_INCLUDED} included revision rounds. Further changes need a change order.`,
    })
  }

  const nextRevisionNumber = item.revisionRoundsUsed + 1

  await prisma.$transaction([
    prisma.revision.create({
      data: { contentItemId, revisionNumber: nextRevisionNumber, feedbackText: notes, revisedBy: 'client' },
    }),
    prisma.contentItem.update({
      where: { id: contentItemId },
      data: { status: 'REVISION_REQUESTED', revisionRoundsUsed: { increment: 1 } },
    }),
    prisma.client.update({
      where: { id: client.id },
      data: { consecutiveApprovals: 0 },
    }),
  ])

  // Reproduce the draft from the feedback — the revision loop now actually loops.
  await revisionProductionTask.trigger({ contentItemId, feedback: notes }, { concurrencyKey: client.id })

  return NextResponse.json({ ok: true, revisionNumber: nextRevisionNumber })
}
