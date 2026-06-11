import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { contentItemId, notes } = await req.json() as { contentItemId: string; notes: string }
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
    select: { id: true, status: true, revisions: { select: { revisionNumber: true }, orderBy: { revisionNumber: 'desc' }, take: 1 } },
  })
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const nextRevisionNumber = (item.revisions[0]?.revisionNumber ?? 0) + 1

  await prisma.$transaction([
    prisma.revision.create({
      data: { contentItemId, revisionNumber: nextRevisionNumber, feedbackText: notes, revisedBy: 'client' },
    }),
    prisma.contentItem.update({
      where: { id: contentItemId },
      data: { status: 'REVISION_REQUESTED' },
    }),
    prisma.client.update({
      where: { id: client.id },
      data: { consecutiveApprovals: 0 },
    }),
  ])

  return NextResponse.json({ ok: true, revisionNumber: nextRevisionNumber })
}
