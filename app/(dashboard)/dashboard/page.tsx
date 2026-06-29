import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChatPanel, type ChatMessage } from '@/components/ChatPanel'
import { CONTENT_COLUMNS, columnForStatus, type ColumnKey } from '@/lib/content-columns'

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.email) redirect('/login')

  const client = await prisma.client.findUnique({
    where: { email: session.user.email },
    select: { id: true, name: true },
  })

  if (!client) {
    return (
      <div>
        <h1 style={{ fontSize: '28px', marginBottom: '8px' }}>Dashboard</h1>
        <p style={{ color: '#9ba3b8' }}>No client account found for this email. Complete onboarding first.</p>
      </div>
    )
  }

  const [messages, items] = await Promise.all([
    prisma.message.findMany({
      where: { clientId: client.id },
      orderBy: { createdAt: 'asc' },
      take: 100,
      select: { id: true, role: true, body: true, createdAt: true },
    }),
    prisma.contentItem.findMany({
      where: { clientId: client.id },
      select: { status: true },
    }),
  ])

  // Tally each content item into its board column for the at-a-glance summary.
  const counts: Record<ColumnKey, number> = { ongoing: 0, awaiting: 0, done: 0, waiting: 0 }
  for (const item of items) counts[columnForStatus(item.status)]++

  const chatMessages: ChatMessage[] = messages.map((m) => ({
    id: m.id,
    role: m.role,
    body: m.body,
    createdAt: m.createdAt.toISOString(),
  }))

  const firstName = client.name?.split(' ')[0]

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '30px', fontWeight: 600, marginBottom: '4px' }}>
          {firstName ? `Welcome back, ${firstName}` : 'Dashboard'}
        </h1>
        <p style={{ color: '#9ba3b8', fontSize: '13px' }}>
          Chat with your agents and track where every piece stands.
        </p>
      </div>

      {/* Task summary */}
      <div style={{ marginBottom: '36px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#f0f2f8' }}>Tasks</h2>
          <Link href="/drafts" style={{ fontSize: '12px', color: '#4b9eff', textDecoration: 'none' }}>
            Open board →
          </Link>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
          {CONTENT_COLUMNS.map((col) => (
            <Link
              key={col.key}
              href="/drafts"
              style={{
                display: 'block',
                textDecoration: 'none',
                background: '#111318',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: '10px',
                padding: '16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '10px' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: col.accent }} />
                <span style={{ fontSize: '12px', color: '#9ba3b8' }}>{col.label}</span>
              </div>
              <p style={{ fontSize: '26px', fontWeight: 600, color: '#f0f2f8' }}>{counts[col.key]}</p>
              <p style={{ fontSize: '11px', color: '#5a6278', marginTop: '2px' }}>{col.hint}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Chat */}
      <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#f0f2f8', marginBottom: '14px' }}>Chat</h2>
      <ChatPanel initialMessages={chatMessages} />
    </div>
  )
}
