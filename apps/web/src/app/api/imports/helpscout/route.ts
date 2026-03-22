import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-api'
import { prisma } from '@/lib/db'
import { uniqueCollectionSlug, uniqueArticleSlug } from '@/lib/unique-slug'

interface HelpScoutTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
}

interface HelpScoutCollection {
  id: string
  name: string
}

interface HelpScoutArticle {
  id: string
  name: string
  text: string | null
  preview: string | null
}

interface HelpScoutCollectionsResponse {
  _embedded?: {
    collections?: HelpScoutCollection[]
  }
  page?: {
    totalPages?: number
    number?: number
  }
}

interface HelpScoutArticlesResponse {
  _embedded?: {
    articles?: HelpScoutArticle[]
  }
  page?: {
    totalPages?: number
    number?: number
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
    clientId?: string
    clientSecret?: string
    status?: 'DRAFT' | 'PUBLISHED'
  }

  const clientId = body.clientId?.trim()
  const clientSecret = body.clientSecret?.trim()

  if (!clientId) return NextResponse.json({ error: 'Client ID is required' }, { status: 400 })
  if (!clientSecret) return NextResponse.json({ error: 'Client Secret is required' }, { status: 400 })

  const importStatus = body.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT'
  const errors: string[] = []
  let collectionsCreated = 0
  let articlesCreated = 0

  // Step 1: OAuth2 client credentials
  let accessToken: string
  try {
    const tokenRes = await fetch('https://api.helpscout.net/v2/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }),
    })
    if (!tokenRes.ok) {
      const text = await tokenRes.text()
      return NextResponse.json(
        { error: `Help Scout OAuth error: ${tokenRes.status} ${text.slice(0, 200)}` },
        { status: 502 }
      )
    }
    const tokenData = await tokenRes.json() as HelpScoutTokenResponse
    accessToken = tokenData.access_token
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Help Scout auth failed: ${msg}` }, { status: 502 })
  }

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  }

  // Step 2: Fetch all collections
  const collectionMap = new Map<string, string>() // Help Scout collection id → HelpNest collection id
  try {
    let page = 1
    for (;;) {
      const res = await fetch(`https://api.helpscout.net/v2/collections?page=${page}&pageSize=50`, { headers })
      if (!res.ok) {
        const text = await res.text()
        return NextResponse.json(
          { error: `Help Scout collections error: ${res.status} ${text.slice(0, 200)}` },
          { status: 502 }
        )
      }
      const data = await res.json() as HelpScoutCollectionsResponse
      const collections = data._embedded?.collections ?? []
      for (const col of collections) {
        const slug = await uniqueCollectionSlug(col.name, workspaceId)
        const created = await prisma.collection.create({
          data: { workspaceId, title: col.name, slug, emoji: '📚' },
        })
        collectionsCreated++
        collectionMap.set(col.id, created.id)
      }
      const totalPages = data.page?.totalPages ?? 1
      if (page >= totalPages) break
      page++
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Failed to fetch Help Scout collections: ${msg}` }, { status: 502 })
  }

  // Fallback collection
  let fallbackCollectionId: string | null = null
  async function getFallback(): Promise<string> {
    if (fallbackCollectionId) return fallbackCollectionId
    const slug = await uniqueCollectionSlug('Help Scout Import', workspaceId)
    const col = await prisma.collection.create({
      data: { workspaceId, title: 'Help Scout Import', slug, emoji: '📥' },
    })
    collectionsCreated++
    fallbackCollectionId = col.id
    return col.id
  }

  // Step 3: Fetch articles per collection
  for (const [hsCollectionId, hnCollectionId] of collectionMap.entries()) {
    try {
      let page = 1
      for (;;) {
        const res = await fetch(
          `https://api.helpscout.net/v2/collections/${hsCollectionId}/articles?page=${page}&pageSize=50`,
          { headers }
        )
        if (!res.ok) break
        const data = await res.json() as HelpScoutArticlesResponse
        const articles = data._embedded?.articles ?? []

        for (const article of articles) {
          try {
            // Fetch full article body (list endpoint only returns preview)
            let content = article.text ?? ''
            if (!content) {
              try {
                const articleRes = await fetch(`https://api.helpscout.net/v2/articles/${article.id}`, { headers })
                if (articleRes.ok) {
                  const full = await articleRes.json() as { text?: string }
                  content = full.text ?? ''
                }
              } catch {
                // use empty content
              }
            }

            const collectionId = hnCollectionId ?? await getFallback()
            const articleSlug = await uniqueArticleSlug(article.name ?? 'Untitled', workspaceId)
            await prisma.article.create({
              data: {
                workspaceId,
                collectionId,
                authorId,
                title: article.name ?? 'Untitled',
                slug: articleSlug,
                content,
                excerpt: article.preview ?? null,
                status: importStatus,
                ...(importStatus === 'PUBLISHED' ? { publishedAt: new Date() } : {}),
              },
            })
            articlesCreated++
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            errors.push(`Article "${article.name}": ${msg}`)
          }
        }

        const totalPages = data.page?.totalPages ?? 1
        if (page >= totalPages) break
        page++
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`Collection ${hsCollectionId}: ${msg}`)
    }
  }

  return NextResponse.json({ collectionsCreated, articlesCreated, errors })
}
