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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const collectionId = searchParams.get('collection')?.trim() ?? ''

  if (collectionId.length === 0) {
    return NextResponse.json(
      { error: 'Missing collection id' },
      { status: 400, headers: CORS_HEADERS },
    )
  }

  const collection = await prisma.collection.findUnique({
    where: { id: collectionId },
    select: {
      id: true,
      title: true,
      description: true,
      slug: true,
      visibility: true,
      isArchived: true,
    },
  })

  if (!collection || collection.visibility !== 'PUBLIC' || collection.isArchived) {
    return NextResponse.json(
      { error: 'Collection not found' },
      { status: 404, headers: CORS_HEADERS },
    )
  }

  const articles = await prisma.article.findMany({
    where: {
      collectionId,
      status: 'PUBLISHED',
    },
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      order: true,
      updatedAt: true,
      author: {
        select: {
          name: true,
          avatar: true,
        },
      },
    },
    orderBy: { order: 'asc' },
  })

  return NextResponse.json(
    {
      collection: {
        title: collection.title,
        description: collection.description,
        slug: collection.slug,
      },
      articles: articles.map(({ order: _order, author, ...rest }) => ({
        ...rest,
        author: {
          name: author.name ?? null,
          avatar: author.avatar ?? null,
        },
      })),
    },
    {
      headers: {
        ...CORS_HEADERS,
        'Cache-Control': 'public, max-age=300, s-maxage=3600',
      },
    },
  )
}
