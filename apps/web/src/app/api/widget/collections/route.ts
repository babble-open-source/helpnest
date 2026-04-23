import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

interface CollectionNode {
  id: string
  title: string
  description: string | null
  slug: string
  articleCount: number
  subCollections: CollectionNode[]
}

interface FlatCollection {
  id: string
  title: string
  description: string | null
  slug: string
  parentId: string | null
  order: number
  _count: { articles: number }
}

function buildTree(flat: FlatCollection[]): CollectionNode[] {
  const nodeMap = new Map<string, CollectionNode & { order: number; parentId: string | null }>()

  for (const col of flat) {
    nodeMap.set(col.id, {
      id: col.id,
      title: col.title,
      description: col.description,
      slug: col.slug,
      articleCount: col._count.articles,
      subCollections: [],
      order: col.order,
      parentId: col.parentId,
    })
  }

  const roots: (CollectionNode & { order: number; parentId: string | null })[] = []

  for (const node of nodeMap.values()) {
    if (node.parentId === null) {
      roots.push(node)
    } else {
      const parent = nodeMap.get(node.parentId)
      if (parent) {
        parent.subCollections.push(node)
      } else {
        // Orphaned sub-collection — treat as root
        roots.push(node)
      }
    }
  }

  function sortNodes(
    nodes: (CollectionNode & { order: number; parentId: string | null })[],
  ): CollectionNode[] {
    return nodes
      .sort((a, b) => a.order - b.order)
      .map(({ order: _order, parentId: _parentId, subCollections, ...rest }) => ({
        ...rest,
        subCollections: sortNodes(
          subCollections as (CollectionNode & { order: number; parentId: string | null })[],
        ),
      }))
  }

  return sortNodes(roots)
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const workspaceSlug = searchParams.get('workspace')?.trim() ?? ''

  if (
    workspaceSlug.length === 0 ||
    workspaceSlug.length > 63 ||
    !SLUG_RE.test(workspaceSlug)
  ) {
    return NextResponse.json(
      { error: 'Invalid workspace slug' },
      { status: 400, headers: CORS_HEADERS },
    )
  }

  const workspace = await prisma.workspace.findUnique({
    where: { slug: workspaceSlug },
    select: { id: true },
  })

  if (!workspace) {
    return NextResponse.json(
      { error: 'Workspace not found' },
      { status: 404, headers: CORS_HEADERS },
    )
  }

  const flat = await prisma.collection.findMany({
    where: {
      workspaceId: workspace.id,
      visibility: 'PUBLIC',
      isArchived: false,
    },
    select: {
      id: true,
      title: true,
      description: true,
      slug: true,
      parentId: true,
      order: true,
      _count: {
        select: {
          articles: {
            where: { status: 'PUBLISHED' },
          },
        },
      },
    },
    orderBy: { order: 'asc' },
  })

  const collections = buildTree(flat)

  return NextResponse.json(
    { collections },
    {
      headers: {
        ...CORS_HEADERS,
        'Cache-Control': 'public, max-age=300, s-maxage=3600',
      },
    },
  )
}
