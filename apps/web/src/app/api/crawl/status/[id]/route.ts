import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-api'
import { prisma } from '@/lib/db'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const crawlJob = await prisma.crawlJob.findFirst({
    where: { id, workspaceId: auth.workspaceId },
    include: {
      pages: {
        select: {
          id: true,
          url: true,
          status: true,
          contentType: true,
          skipReason: true,
          articleId: true,
          similarArticleId: true,
          article: { select: { id: true, title: true, slug: true, excerpt: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!crawlJob) return NextResponse.json({ error: 'Crawl job not found' }, { status: 404 })

  return NextResponse.json({
    id: crawlJob.id,
    status: crawlJob.status,
    mode: crawlJob.mode,
    goalPrompt: crawlJob.goalPrompt,
    sourceUrl: crawlJob.sourceUrl,
    totalPages: crawlJob.totalPages,
    processedPages: crawlJob.processedPages,
    articlesCreated: crawlJob.articlesCreated,
    error: crawlJob.error,
    createdAt: crawlJob.createdAt,
    completedAt: crawlJob.completedAt,
    pages: crawlJob.pages,
    summary: {
      generated: crawlJob.pages.filter((p) => p.status === 'GENERATED').length,
      skipped: crawlJob.pages.filter((p) => p.status === 'SKIPPED').length,
      failed: crawlJob.pages.filter((p) => p.status === 'FAILED').length,
      pending: crawlJob.pages.filter((p) => p.status === 'PENDING').length,
    },
  })
}
