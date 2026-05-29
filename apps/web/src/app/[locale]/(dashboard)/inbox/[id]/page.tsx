import { auth, resolveSessionUserId } from '@/lib/auth'
import { resolveWorkspaceId } from '@/lib/workspace'
import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import { redirect } from 'next/navigation'
import { ConversationDetail } from './ConversationDetail'

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const session = await auth()
  if (!session?.user) redirect('/login')

  const userId = await resolveSessionUserId(session)
  if (!userId) redirect('/login')

  const workspaceId = await resolveWorkspaceId(userId)
  if (!workspaceId) redirect('/')

  const member = await prisma.member.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { id: true },
  })
  if (!member) redirect('/')

  const conversation = await prisma.conversation.findFirst({
    where: { id, workspaceId },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
      contact: {
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          avatarUrl: true,
          organizations: {
            select: {
              isPrimary: true,
              organization: {
                select: { id: true, name: true, plan: true, domains: true },
              },
            },
          },
        },
      },
      organization: {
        select: { id: true, name: true, plan: true },
      },
      assignedTo: {
        select: {
          id: true,
          user: { select: { name: true, email: true } },
        },
      },
      articles: {
        include: {
          article: {
            select: {
              id: true,
              title: true,
              slug: true,
              collection: { select: { slug: true, title: true } },
            },
          },
        },
      },
    },
  })

  if (!conversation) notFound()

  const members: Array<{ id: string; user: { name: string | null; email: string } }> = await prisma.member.findMany({
    where: { workspaceId: workspaceId, deactivatedAt: null },
    select: { id: true, user: { select: { name: true, email: true } } },
    orderBy: { user: { name: 'asc' } },
  })

  // Serialize all Date objects before passing to the client component.
  const serializedConv = {
    id: conversation.id,
    number: conversation.number ?? null,
    status: conversation.status,
    customerName: conversation.customerName,
    customerEmail: conversation.customerEmail,
    subject: conversation.subject,
    aiConfidence: conversation.aiConfidence,
    escalationReason: conversation.escalationReason,
    resolutionSummary: conversation.resolutionSummary,
    contact: conversation.contact
      ? {
          id: conversation.contact.id,
          fullName: conversation.contact.fullName,
          email: conversation.contact.email,
          phone: conversation.contact.phone ?? null,
          avatarUrl: conversation.contact.avatarUrl ?? null,
          primaryOrganization:
            conversation.contact.organizations.find((co) => co.isPrimary)?.organization ?? null,
        }
      : null,
    organization: conversation.organization
      ? {
          id: conversation.organization.id,
          name: conversation.organization.name,
          plan: conversation.organization.plan ?? null,
        }
      : null,
    assignedTo: conversation.assignedTo
      ? {
          id: conversation.assignedTo.id,
          name: conversation.assignedTo.user.name,
          email: conversation.assignedTo.user.email,
        }
      : null,
    articles: (conversation.articles as Array<{
      article: {
        id: string
        title: string
        slug: string
        collection: { slug: string; title: string }
      }
    }>).map((ca) => ({
      id: ca.article.id,
      title: ca.article.title,
      slug: ca.article.slug,
      collection: ca.article.collection,
    })),
    messages: (conversation.messages as Array<{
      id: string
      role: string
      content: string
      isInternal: boolean
      authorMemberId: string | null
      sources: unknown
      confidence: number | null
      feedbackHelpful: boolean | null
      createdAt: Date
    }>).map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      isInternal: m.isInternal,
      authorMemberId: m.authorMemberId ?? null,
      sources: m.sources,
      confidence: m.confidence,
      feedbackHelpful: m.feedbackHelpful,
      createdAt: m.createdAt.toISOString(),
    })),
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
  }

  const serializedMembers = members.map((m) => ({
    id: m.id,
    name: m.user.name,
    email: m.user.email,
  }))

  return (
    <div className="flex flex-col lg:flex-row h-full min-h-0">
      <ConversationDetail
        conversation={serializedConv}
        members={serializedMembers}
        currentMemberId={member.id}
      />
    </div>
  )
}
