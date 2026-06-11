import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyApprovalToken } from '@/lib/tokens'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const variantLabel = req.nextUrl.searchParams.get('variant')

  const verified = verifyApprovalToken(token)
  if (!verified) {
    return NextResponse.redirect(`${APP_URL}/approval-error?reason=invalid`)
  }

  const { contentItemId, action } = verified

  const item = await prisma.contentItem.findUnique({
    where: { id: contentItemId },
    select: { id: true, status: true, clientId: true, contentType: true },
  })

  if (!item) {
    return NextResponse.redirect(`${APP_URL}/approval-error?reason=not_found`)
  }

  // Already actioned — idempotent
  if (item.status !== 'DELIVERED' && item.status !== 'HOLD_RECOMMENDED' && item.status !== 'DRAFT') {
    return NextResponse.redirect(`${APP_URL}/drafts/${item.id}?already_actioned=true`)
  }

  switch (action) {
    case 'approve': {
      if (variantLabel) {
        // Discovery Mode: client picked a variant — store as first EXAMPLES entry
        const examplesSection = await prisma.clientContext.findUnique({
          where: { clientId_sectionType: { clientId: item.clientId, sectionType: 'EXAMPLES' } },
        })
        const variantNote = `\n\n### Approved discovery variant: ${variantLabel}\n*(Selected by client as closest to their voice)*`
        await prisma.clientContext.upsert({
          where: { clientId_sectionType: { clientId: item.clientId, sectionType: 'EXAMPLES' } },
          update: {
            content: (examplesSection?.content ?? '') + variantNote,
            version: { increment: 1 },
            updatedBy: 'discovery-selection',
          },
          create: {
            clientId: item.clientId,
            sectionType: 'EXAMPLES',
            content: variantNote,
            updatedBy: 'discovery-selection',
          },
        })
      }

      await prisma.$transaction([
        prisma.contentItem.update({
          where: { id: contentItemId },
          data: { status: 'APPROVED', approvedAt: new Date() },
        }),
        prisma.client.update({
          where: { id: item.clientId },
          data: { consecutiveApprovals: { increment: 1 } },
        }),
      ])

      return NextResponse.redirect(`${APP_URL}/approved?id=${contentItemId}`)
    }

    case 'revise': {
      await prisma.contentItem.update({
        where: { id: contentItemId },
        data: { status: 'REVISION_REQUESTED' },
      })
      await prisma.client.update({
        where: { id: item.clientId },
        data: { consecutiveApprovals: 0 },
      })
      return NextResponse.redirect(`${APP_URL}/revise?id=${contentItemId}`)
    }

    case 'hold': {
      await prisma.contentItem.update({
        where: { id: contentItemId },
        data: { status: 'ON_HOLD' },
      })
      return NextResponse.redirect(`${APP_URL}/drafts/${contentItemId}?held=true`)
    }

    default:
      return NextResponse.redirect(`${APP_URL}/approval-error?reason=invalid_action`)
  }
}
