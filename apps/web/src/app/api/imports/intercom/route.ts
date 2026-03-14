import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-api'
import { prisma } from '@/lib/db'

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 200)
}

async function uniqueCollectionSlug(base: string, workspaceId: string): Promise<string> {
  let slug = slugify(base) || 'untitled'
  let attempt = 0
  for (;;) {
    const candidate = attempt === 0 ? slug : `${slug}-${attempt}`
    const existing = await prisma.collection.findFirst({ where: { workspaceId, slug: candidate } })
    if (!existing) return candidate
    attempt++
  }
}

async function uniqueArticleSlug(base: string, workspaceId: string): Promise<string> {
  let slug = slugify(base) || 'untitled'
  let attempt = 0
  for (;;) {
    const candidate = attempt === 0 ? slug : `${slug}-${attempt}`
    const existing = await prisma.article.findFirst({ where: { workspaceId, slug: candidate } })
    if (!existing) return candidate
    attempt++
  }
}

interface IntercomCollection {
  id: string
  name: string
}

interface IntercomArticle {
  id: string
  title: string
  body: string | null
  description: string | null
  parent_id: string | null
  parent_type: string | null
}

interface IntercomArticlesResponse {
  data: IntercomArticle[]
  pages?: {
    next?: string
    total_pages?: number
  }
}

interface IntercomCollectionsResponse {
  data: IntercomCollection[]
  pages?: {
    next?: string
  }
}

export async function POST(request: Request) {
  const auth = await requireAuth(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (auth.via === 'session' && auth.userId) {
    const member = await prisma.member.findFirst({
      where: {
        userId: auth.userId,
        workspaceId: auth.workspaceId,
        role: { in: ['OWNER', 'ADMIN', 'EDITOR'] },
      },
    })
    if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { workspaceId, userId } = auth

  let authorId = userId
  if (!authorId) {
    const member = await prisma.member.findFirst({
      where: { workspaceId },
      select: { userId: true },
      orderBy: { id: 'asc' },
    })
    if (!member) return NextResponse.json({ error: 'No workspace member found' }, { status: 500 })
    authorId = member.userId
  }

  const body = await request.json() as {
    token?: string
    status?: 'DRAFT' | 'PUBLISHED'
  }

  const token = body.token?.trim()
  if (!token) return NextResponse.json({ error: 'Intercom access token is required' }, { status: 400 })

  const importStatus = body.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT'
  const errors: string[] = []
  let collectionsCreated = 0
  let articlesCreated = 0

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }

  // Fetch all collections
  const intercomCollections = new Map<string, string>() // intercom collection id → HelpNest collection id
  try {
    let url: string | undefined = 'https://api.intercom.io/help_center/collections?per_page=250'
    while (url) {
      const res = await fetch(url, { headers })
      if (!res.ok) {
        const text = await res.text()
        return NextResponse.json(
          { error: `Intercom API error fetching collections: ${res.status} ${text.slice(0, 200)}` },
          { status: 502 }
        )
      }
      const data = await res.json() as IntercomCollectionsResponse
      for (const col of data.data ?? []) {
        const slug = await uniqueCollectionSlug(col.name, workspaceId)
        const created = await prisma.collection.create({
          data: {
            workspaceId,
            title: col.name,
            slug,
            emoji: '📚',
          },
        })
        collectionsCreated++
        intercomCollections.set(col.id, created.id)
      }
      url = data.pages?.next ?? undefined
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Failed to fetch Intercom collections: ${msg}` }, { status: 502 })
  }

  // Fall back to a single catch-all collection if nothing was returned
  async function getFallbackCollectionId(): Promise<string> {
    const key = '__fallback__'
    if (intercomCollections.has(key)) return intercomCollections.get(key)!
    const slug = await uniqueCollectionSlug('Intercom Import', workspaceId)
    const col = await prisma.collection.create({
      data: { workspaceId, title: 'Intercom Import', slug, emoji: '📥' },
    })
    collectionsCreated++
    intercomCollections.set(key, col.id)
    return col.id
  }

  // Fetch all articles
  try {
    let url: string | undefined = 'https://api.intercom.io/articles?per_page=250'
    while (url) {
      const res = await fetch(url, { headers })
      if (!res.ok) {
        const text = await res.text()
        errors.push(`Intercom API error fetching articles: ${res.status} ${text.slice(0, 200)}`)
        break
      }
      const data = await res.json() as IntercomArticlesResponse
      for (const article of data.data ?? []) {
        try {
          let collectionId: string
          if (article.parent_id && article.parent_type === 'collection') {
            collectionId = intercomCollections.get(article.parent_id) ?? await getFallbackCollectionId()
          } else {
            collectionId = await getFallbackCollectionId()
          }

          const articleSlug = await uniqueArticleSlug(article.title ?? 'Untitled', workspaceId)
          await prisma.article.create({
            data: {
              workspaceId,
              collectionId,
              authorId,
              title: article.title ?? 'Untitled',
              slug: articleSlug,
              content: article.body ?? '',
              excerpt: article.description ?? null,
              status: importStatus,
              ...(importStatus === 'PUBLISHED' ? { publishedAt: new Date() } : {}),
            },
          })
          articlesCreated++
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          errors.push(`Article "${article.title}": ${msg}`)
        }
      }
      url = data.pages?.next ?? undefined
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Failed to fetch Intercom articles: ${msg}` }, { status: 502 })
  }

  return NextResponse.json({ collectionsCreated, articlesCreated, errors })
}
