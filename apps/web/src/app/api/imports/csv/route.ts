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

/**
 * Minimal RFC-4180 CSV parser that handles quoted fields with embedded commas
 * and newlines. Returns an array of rows, each row being an array of field strings.
 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0

  while (i < text.length) {
    const ch = text[i]
    const next = text[i + 1]

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        // Escaped double-quote inside a quoted field
        field += '"'
        i += 2
        continue
      }
      if (ch === '"') {
        inQuotes = false
        i++
        continue
      }
      field += ch
      i++
      continue
    }

    if (ch === '"') {
      inQuotes = true
      i++
      continue
    }

    if (ch === ',') {
      row.push(field)
      field = ''
      i++
      continue
    }

    if (ch === '\r' && next === '\n') {
      row.push(field)
      field = ''
      rows.push(row)
      row = []
      i += 2
      continue
    }

    if (ch === '\n' || ch === '\r') {
      row.push(field)
      field = ''
      rows.push(row)
      row = []
      i++
      continue
    }

    field += ch
    i++
  }

  // Last field / row
  if (field || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  // Drop trailing empty rows
  while (rows.length > 0 && (rows[rows.length - 1] ?? []).every((f) => f === '')) {
    rows.pop()
  }

  return rows
}

interface CsvRow {
  title: string
  content: string
  excerpt?: string
  collection?: string
}

function parseCsvRows(text: string): CsvRow[] {
  const rows = parseCsv(text)
  if (rows.length < 2) return []

  const headers = (rows[0] ?? []).map((h) => h.trim().toLowerCase())
  const titleIdx = headers.indexOf('title')
  const contentIdx = headers.indexOf('content')
  const excerptIdx = headers.indexOf('excerpt')
  const collectionIdx = headers.indexOf('collection')

  if (titleIdx === -1 || contentIdx === -1) return []

  return rows.slice(1).map((row): CsvRow => ({
    title: (row[titleIdx] ?? '').trim() || 'Untitled',
    content: (row[contentIdx] ?? '').trim(),
    excerpt: excerptIdx !== -1 ? (row[excerptIdx] ?? '').trim() || undefined : undefined,
    collection: collectionIdx !== -1 ? (row[collectionIdx] ?? '').trim() || undefined : undefined,
  }))
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

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid multipart form data' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
  }

  const importStatus = (formData.get('status') as string) === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT'
  const errors: string[] = []
  let collectionsCreated = 0
  let articlesCreated = 0

  const fileName = file.name ?? ''
  const fileText = await file.text()
  const ext = fileName.split('.').pop()?.toLowerCase()

  const collectionCache = new Map<string, string>() // collection name → id

  async function getOrCreateCollection(name: string): Promise<string> {
    const key = name.toLowerCase()
    if (collectionCache.has(key)) return collectionCache.get(key)!
    const slug = await uniqueCollectionSlug(name, workspaceId)
    const col = await prisma.collection.create({
      data: { workspaceId, title: name, slug, emoji: '📁' },
    })
    collectionsCreated++
    collectionCache.set(key, col.id)
    return col.id
  }

  // Default fallback collection
  let defaultCollectionId: string | null = null
  async function getDefaultCollection(): Promise<string> {
    if (defaultCollectionId) return defaultCollectionId
    // Try to find an existing collection first
    const existing = await prisma.collection.findFirst({
      where: { workspaceId, isArchived: false },
      orderBy: { order: 'asc' },
      select: { id: true },
    })
    if (existing) {
      defaultCollectionId = existing.id
      return existing.id
    }
    return getOrCreateCollection('Imported Articles')
  }

  if (ext === 'md' || ext === 'txt') {
    // Single markdown / text file → single article
    const titleFromFilename = fileName
      .replace(/\.(md|txt)$/i, '')
      .replace(/[-_]/g, ' ')
      .trim() || 'Untitled'

    try {
      const collectionId = await getDefaultCollection()
      const articleSlug = await uniqueArticleSlug(titleFromFilename, workspaceId)
      await prisma.article.create({
        data: {
          workspaceId,
          collectionId,
          authorId,
          title: titleFromFilename,
          slug: articleSlug,
          content: fileText,
          status: importStatus,
          ...(importStatus === 'PUBLISHED' ? { publishedAt: new Date() } : {}),
        },
      })
      articlesCreated++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`File "${fileName}": ${msg}`)
    }
  } else {
    // CSV
    const csvRows = parseCsvRows(fileText)
    if (!csvRows.length) {
      return NextResponse.json(
        { error: 'CSV file is empty or missing required columns (title, content)' },
        { status: 400 }
      )
    }

    for (const row of csvRows) {
      try {
        const collectionId = row.collection
          ? await getOrCreateCollection(row.collection)
          : await getDefaultCollection()

        const articleSlug = await uniqueArticleSlug(row.title, workspaceId)
        await prisma.article.create({
          data: {
            workspaceId,
            collectionId,
            authorId,
            title: row.title,
            slug: articleSlug,
            content: row.content,
            excerpt: row.excerpt ?? null,
            status: importStatus,
            ...(importStatus === 'PUBLISHED' ? { publishedAt: new Date() } : {}),
          },
        })
        articlesCreated++
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push(`Row "${row.title}": ${msg}`)
      }
    }
  }

  return NextResponse.json({ collectionsCreated, articlesCreated, errors })
}
