import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET(
  _request: Request,
  { params: paramsPromise }: { params: Promise<{ id: string }> },
) {
  const { id } = await paramsPromise

  const article = await prisma.article.findFirst({
    where: {
      id,
      status: 'PUBLISHED',
    },
    select: {
      id: true,
      title: true,
      slug: true,
      content: true,
      excerpt: true,
      updatedAt: true,
      author: { select: { name: true, avatar: true } },
      collection: {
        select: {
          title: true,
          slug: true,
          visibility: true,
        },
      },
      workspace: { select: { slug: true } },
    },
  })

  if (!article || article.collection.visibility !== 'PUBLIC') {
    return NextResponse.json(
      { error: 'Article not found' },
      { status: 404, headers: CORS_HEADERS },
    )
  }

  return NextResponse.json(
    {
      id: article.id,
      title: article.title,
      slug: article.slug,
      content: article.content,
      excerpt: article.excerpt,
      author: { name: article.author.name, avatar: article.author.avatar },
      updatedAt: article.updatedAt.toISOString(),
      collection: { title: article.collection.title, slug: article.collection.slug },
      workspaceSlug: article.workspace.slug,
    },
    {
      headers: {
        ...CORS_HEADERS,
        'Cache-Control': 'public, max-age=300, s-maxage=3600',
      },
    },
  )
}
