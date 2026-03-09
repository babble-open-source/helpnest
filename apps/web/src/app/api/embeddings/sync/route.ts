import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { qdrant, COLLECTION_NAME, ensureCollection, chunkText, buildPointId } from '@/lib/qdrant'
import { embedBatch } from '@/lib/embeddings'

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as { workspaceId?: string }

  const member = await prisma.member.findFirst({
    where: { user: { email: session.user.email! } },
    select: { workspaceId: true },
  })
  if (!member) return NextResponse.json({ error: 'No workspace' }, { status: 403 })

  const targetWorkspaceId = body.workspaceId ?? member.workspaceId

  await ensureCollection()

  const articles = await prisma.article.findMany({
    where: { workspaceId: targetWorkspaceId, status: 'PUBLISHED' },
    select: { id: true, title: true, content: true, slug: true, collectionId: true },
  })

  let totalPoints = 0

  for (const article of articles) {
    const fullText = `${article.title}\n\n${article.content}`
    const chunks = chunkText(fullText)
    const embeddings = await embedBatch(chunks)

    const points = chunks.map((chunk, i) => ({
      id: buildPointId(article.id, i),
      vector: embeddings[i] ?? [],
      payload: {
        articleId: article.id,
        workspaceId: targetWorkspaceId,
        collectionId: article.collectionId,
        slug: article.slug,
        title: article.title,
        chunk,
        chunkIndex: i,
      },
    }))

    await qdrant.upsert(COLLECTION_NAME, { points, wait: true })
    totalPoints += points.length

    await prisma.searchIndex.upsert({
      where: { articleId: article.id },
      update: { updatedAt: new Date() },
      create: {
        articleId: article.id,
        workspaceId: targetWorkspaceId,
        embedding: { synced: true, chunks: chunks.length },
      },
    })
  }

  return NextResponse.json({ success: true, articles: articles.length, points: totalPoints })
}
