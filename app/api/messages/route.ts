import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

// Founder posts a chat message. Stored unconsumed; the Content Writer folds any
// unconsumed founder messages into its next run and marks them consumedAt.
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { body } = (await req.json()) as { body?: string }
  if (!body?.trim()) return NextResponse.json({ error: 'body required' }, { status: 400 })

  const client = await prisma.client.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  })
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const message = await prisma.message.create({
    data: { clientId: client.id, role: 'founder', body: body.trim() },
    select: { id: true, role: true, body: true, createdAt: true },
  })

  return NextResponse.json({ ok: true, message })
}
