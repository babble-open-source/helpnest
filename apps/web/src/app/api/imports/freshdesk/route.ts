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

interface FreshdeskCategory {
  id: number
  name: string
}

interface FreshdeskFolder {
  id: number
  name: string
  category_id: number
}

interface FreshdeskArticle {
  id: number
  title: string
  description: string | null
  folder_id: number
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
    apiKey?: string
    status?: 'DRAFT' | 'PUBLISHED'
  }

  const subdomain = body.subdomain?.trim()
  const apiKey = body.apiKey?.trim()

  if (!subdomain) return NextResponse.json({ error: 'Freshdesk subdomain is required' }, { status: 400 })
  if (!apiKey) return NextResponse.json({ error: 'Freshdesk API key is required' }, { status: 400 })

  const importStatus = body.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT'
  const errors: string[] = []
  let collectionsCreated = 0
  let articlesCreated = 0

  // Freshdesk Basic auth: apiKey:X
  const credentials = Buffer.from(`${apiKey}:X`).toString('base64')
  const headers = {
    Authorization: `Basic ${credentials}`,
    'Content-Type': 'application/json',
  }
  const base = `https://${subdomain}.freshdesk.com/api/v2`

  // Fetch categories
  let categories: FreshdeskCategory[] = []
  try {
    const res = await fetch(`${base}/solutions/categories`, { headers })
    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json(
        { error: `Freshdesk API error: ${res.status} ${text.slice(0, 200)}` },
        { status: 502 }
      )
    }
    categories = await res.json() as FreshdeskCategory[]
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Failed to fetch Freshdesk categories: ${msg}` }, { status: 502 })
  }

  // For each category, fetch folders (sub-collections) and articles
  for (const category of categories) {
    // Create a parent collection for the category
    let categoryCollectionId: string
    try {
      const slug = await uniqueCollectionSlug(category.name, workspaceId)
      const col = await prisma.collection.create({
        data: { workspaceId, title: category.name, slug, emoji: '📂' },
      })
      collectionsCreated++
      categoryCollectionId = col.id
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`Category "${category.name}": ${msg}`)
      continue
    }

    // Fetch folders for this category
    let folders: FreshdeskFolder[] = []
    try {
      const res = await fetch(`${base}/solutions/categories/${category.id}/folders`, { headers })
      if (res.ok) {
        folders = await res.json() as FreshdeskFolder[]
      }
    } catch {
      // ignore — fall back to no folders
    }

    const folderCollectionMap = new Map<number, string>()

    for (const folder of folders) {
      try {
        const slug = await uniqueCollectionSlug(folder.name, workspaceId)
        const col = await prisma.collection.create({
          data: {
            workspaceId,
            title: folder.name,
            slug,
            emoji: '📁',
            parentId: categoryCollectionId,
          },
        })
        collectionsCreated++
        folderCollectionMap.set(folder.id, col.id)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push(`Folder "${folder.name}": ${msg}`)
      }
    }

    // Freshdesk v2: articles live under /solutions/folders/{folder_id}/articles
    for (const folder of folders) {
      try {
        let page = 1
        for (;;) {
          const res = await fetch(
            `${base}/solutions/folders/${folder.id}/articles?page=${page}&per_page=100`,
            { headers }
          )
          if (!res.ok) {
            const text = await res.text()
            errors.push(`Folder "${folder.name}" articles (page ${page}): ${res.status} ${text.slice(0, 200)}`)
            break
          }
          const articles = await res.json() as FreshdeskArticle[]
          if (!articles.length) break

          const collectionId = folderCollectionMap.get(folder.id) ?? categoryCollectionId

          for (const article of articles) {
            try {
              const articleSlug = await uniqueArticleSlug(article.title ?? 'Untitled', workspaceId)
              await prisma.article.create({
                data: {
                  workspaceId,
                  collectionId,
                  authorId,
                  title: article.title ?? 'Untitled',
                  slug: articleSlug,
                  content: article.description ?? '',
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
          page++
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push(`Folder "${folder.name}" articles: ${msg}`)
      }
    }
  }

  return NextResponse.json({ collectionsCreated, articlesCreated, errors })
}
