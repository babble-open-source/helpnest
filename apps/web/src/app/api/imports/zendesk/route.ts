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

interface ZendeskSection {
  id: number
  name: string
}

interface ZendeskArticle {
  id: number
  title: string
  body: string | null
  section_id: number | null
  draft: boolean
}

interface ZendeskSectionsResponse {
  sections: ZendeskSection[]
  next_page: string | null
}

interface ZendeskArticlesResponse {
  articles: ZendeskArticle[]
  next_page: string | null
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
    subdomain?: string
    email?: string
    token?: string
    status?: 'DRAFT' | 'PUBLISHED'
  }

  const subdomain = body.subdomain?.trim()
  const email = body.email?.trim()
  const token = body.token?.trim()

  if (!subdomain) return NextResponse.json({ error: 'Zendesk subdomain is required' }, { status: 400 })
  if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  if (!token) return NextResponse.json({ error: 'API token is required' }, { status: 400 })

  const importStatus = body.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT'
  const errors: string[] = []
  let collectionsCreated = 0
  let articlesCreated = 0

  // Basic auth: email/token:{api_token}
  const credentials = Buffer.from(`${email}/token:${token}`).toString('base64')
  const headers = {
    Authorization: `Basic ${credentials}`,
    'Content-Type': 'application/json',
  }
  const base = `https://${subdomain}.zendesk.com/api/v2`

  // Fetch all sections → collections
  const sectionMap = new Map<number, string>() // zendesk section id → HelpNest collection id
  try {
    let url: string | null = `${base}/help_center/sections.json?per_page=100`
    while (url) {
      const res = await fetch(url, { headers })
      if (!res.ok) {
        const text = await res.text()
        return NextResponse.json(
          { error: `Zendesk API error: ${res.status} ${text.slice(0, 200)}` },
          { status: 502 }
        )
      }
      const data = await res.json() as ZendeskSectionsResponse
      for (const section of data.sections ?? []) {
        const slug = await uniqueCollectionSlug(section.name, workspaceId)
        const col = await prisma.collection.create({
          data: { workspaceId, title: section.name, slug, emoji: '📂' },
        })
        collectionsCreated++
        sectionMap.set(section.id, col.id)
      }
      url = data.next_page
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Failed to fetch Zendesk sections: ${msg}` }, { status: 502 })
  }

  // Fallback collection for articles without a section
  let fallbackCollectionId: string | null = null
  async function getFallback(): Promise<string> {
    if (fallbackCollectionId) return fallbackCollectionId
    const slug = await uniqueCollectionSlug('Zendesk Import', workspaceId)
    const col = await prisma.collection.create({
      data: { workspaceId, title: 'Zendesk Import', slug, emoji: '📥' },
    })
    collectionsCreated++
    fallbackCollectionId = col.id
    return col.id
  }

  // Fetch all articles
  try {
    let url: string | null = `${base}/help_center/articles.json?per_page=100`
    while (url) {
      const res = await fetch(url, { headers })
      if (!res.ok) {
        const text = await res.text()
        errors.push(`Zendesk API error fetching articles: ${res.status} ${text.slice(0, 200)}`)
        break
      }
      const data = await res.json() as ZendeskArticlesResponse
      for (const article of data.articles ?? []) {
        try {
          const collectionId = article.section_id && sectionMap.has(article.section_id)
            ? sectionMap.get(article.section_id)!
            : await getFallback()

          const articleSlug = await uniqueArticleSlug(article.title ?? 'Untitled', workspaceId)
          await prisma.article.create({
            data: {
              workspaceId,
              collectionId,
              authorId,
              title: article.title ?? 'Untitled',
              slug: articleSlug,
              content: article.body ?? '',
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
      url = data.next_page
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Failed to fetch Zendesk articles: ${msg}` }, { status: 502 })
  }

  return NextResponse.json({ collectionsCreated, articlesCreated, errors })
}
