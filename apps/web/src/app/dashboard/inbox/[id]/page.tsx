import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { redirect, notFound } from 'next/navigation'
import { ConversationDetail } from './ConversationDetail'

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const session = await auth()
  if (!session?.user) redirect('/login')

  const member = await prisma.member.findFirst({
    where: { user: { email: session.user.email! } },
    select: { workspaceId: true, id: true, userId: true },
  })
  if (!member) redirect('/dashboard')

  const conversation = await prisma.conversation.findFirst({
    where: { id, workspaceId: member.workspaceId },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
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
    where: { workspaceId: member.workspaceId, deactivatedAt: null },
    select: { id: true, user: { select: { name: true, email: true } } },
    orderBy: { user: { name: 'asc' } },
  })

  // Serialize all Date objects before passing to the client component.
  const serializedConv = {
    id: conversation.id,
    status: conversation.status,
    customerName: conversation.customerName,
    customerEmail: conversation.customerEmail,
    subject: conversation.subject,
    aiConfidence: conversation.aiConfidence,
    escalationReason: conversation.escalationReason,
    resolutionSummary: conversation.resolutionSummary,
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
      sources: unknown
      confidence: number | null
      feedbackHelpful: boolean | null
      createdAt: Date
    }>).map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
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
    <div className="flex flex-col lg:flex-row h-full">
      <ConversationDetail
        conversation={serializedConv}
        members={serializedMembers}
        currentMemberId={member.id}
      />
    </div>
  )
}
