import { auth, resolveSessionUserId } from '@/lib/auth'
import { resolveWorkspaceId } from '@/lib/workspace'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { InboxList } from './InboxList'

export default async function InboxPage() {
  const [session, t] = await Promise.all([auth(), getTranslations('inboxPage')])
  if (!session?.user) redirect('/login')

  const userId = await resolveSessionUserId(session)
  if (!userId) redirect('/login')

  const workspaceId = await resolveWorkspaceId(userId)
  if (!workspaceId) redirect('/dashboard')

  type InboxConv = {
    id: string
    status: string
    customerName: string | null
    customerEmail: string | null
    subject: string | null
    aiConfidence: number | null
    escalationReason: string | null
    assignedTo: { user: { name: string | null } } | null
    messages: Array<{ content: string }>
    _count: { messages: number }
    createdAt: Date
    updatedAt: Date
  }

  const [escalated, active, resolved]: [InboxConv[], InboxConv[], InboxConv[]] = await Promise.all([
    prisma.conversation.findMany({
      where: { workspaceId: workspaceId, status: 'ESCALATED' },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      include: {
        messages: { take: 1, orderBy: { createdAt: 'asc' }, select: { content: true } },
        assignedTo: { select: { user: { select: { name: true } } } },
        _count: { select: { messages: true } },
      },
    }),
    prisma.conversation.findMany({
      where: { workspaceId: workspaceId, status: { in: ['ACTIVE', 'HUMAN_ACTIVE'] } },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      include: {
        messages: { take: 1, orderBy: { createdAt: 'asc' }, select: { content: true } },
        assignedTo: { select: { user: { select: { name: true } } } },
        _count: { select: { messages: true } },
      },
    }),
    prisma.conversation.findMany({
      where: {
        workspaceId: workspaceId,
        status: { in: ['RESOLVED_AI', 'RESOLVED_HUMAN', 'CLOSED'] },
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      include: {
        messages: { take: 1, orderBy: { createdAt: 'asc' }, select: { content: true } },
        assignedTo: { select: { user: { select: { name: true } } } },
        _count: { select: { messages: true } },
      },
    }),
  ])

  // Serialize dates for client component — Date objects are not serializable across
  // the server/client boundary in Next.js App Router.
  const serialize = (convs: InboxConv[]) =>
    convs.map((c) => ({
      id: c.id,
      status: c.status,
      customerName: c.customerName,
      customerEmail: c.customerEmail,
      subject: c.subject,
      aiConfidence: c.aiConfidence,
      escalationReason: c.escalationReason,
      assignedTo: c.assignedTo?.user?.name ?? null,
      firstMessage: c.messages[0]?.content?.slice(0, 200) ?? null,
      messageCount: c._count.messages,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }))

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6">
        <h1 className="font-serif text-2xl sm:text-3xl text-ink">{t('title')}</h1>
        <p className="text-muted mt-1">{t('description')}</p>
      </div>
      <InboxList
        escalated={serialize(escalated)}
        active={serialize(active)}
        resolved={serialize(resolved)}
      />
    </div>
  )
}
