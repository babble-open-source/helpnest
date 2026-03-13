import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import { KnowledgeGapsList } from './KnowledgeGapsList'

export default async function KnowledgeGapsPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const member = await prisma.member.findFirst({
    where: { user: { email: session.user.email! } },
    select: { workspaceId: true, workspace: { select: { slug: true } } },
  })
  if (!member) redirect('/dashboard')

  type KnowledgeGapRow = {
    id: string
    query: string
    occurrences: number
    lastSeenAt: Date
    resolvedAt: Date | null
    resolvedBy: { name: string | null } | null
    resolvedArticle: { id: string; title: string } | null
    createdAt: Date
  }

  const [unresolved, resolved]: [KnowledgeGapRow[], KnowledgeGapRow[]] = await Promise.all([
    prisma.knowledgeGap.findMany({
      where: { workspaceId: member.workspaceId, resolvedAt: null },
      orderBy: { occurrences: 'desc' },
      take: 50,
      include: {
        resolvedBy: { select: { name: true } },
        resolvedArticle: { select: { id: true, title: true } },
      },
    }),
    prisma.knowledgeGap.findMany({
      where: { workspaceId: member.workspaceId, resolvedAt: { not: null } },
      orderBy: { resolvedAt: 'desc' },
      take: 50,
      include: {
        resolvedBy: { select: { name: true } },
        resolvedArticle: { select: { id: true, title: true } },
      },
    }),
  ])

  const serialize = (gaps: KnowledgeGapRow[]) =>
    gaps.map((g) => ({
      id: g.id,
      query: g.query,
      occurrences: g.occurrences,
      lastSeenAt: g.lastSeenAt.toISOString(),
      resolvedAt: g.resolvedAt?.toISOString() || null,
      resolvedBy: g.resolvedBy?.name || null,
      resolvedArticle: g.resolvedArticle
        ? { id: g.resolvedArticle.id, title: g.resolvedArticle.title }
        : null,
      createdAt: g.createdAt.toISOString(),
    }))

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6">
        <h1 className="font-serif text-2xl sm:text-3xl text-ink">Knowledge Gaps</h1>
        <p className="text-muted mt-1">Questions your AI couldn&apos;t answer confidently</p>
      </div>
      <KnowledgeGapsList
        unresolved={serialize(unresolved)}
        resolved={serialize(resolved)}
        workspaceSlug={member.workspace.slug}
      />
    </div>
  )
}
