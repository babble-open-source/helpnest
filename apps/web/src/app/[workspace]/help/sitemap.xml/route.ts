import { prisma } from '@/lib/db'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function toLastmod(date: Date): string {
  return date.toISOString().split('T')[0]!
}

interface SitemapEntry {
  loc: string
  lastmod: string
  priority: string
}

function buildSitemapXml(entries: SitemapEntry[]): string {
  const urls = entries
    .map(
      ({ loc, lastmod, priority }) =>
        `  <url>\n    <loc>${xmlEscape(loc)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <priority>${priority}</priority>\n  </url>`,
    )
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`
}

export async function GET(
  _request: Request,
  { params: paramsPromise }: { params: Promise<{ workspace: string }> },
) {
  const params = await paramsPromise
  const { workspace: slug } = params

  const workspace = await prisma.workspace.findUnique({
    where: { slug },
    select: { id: true, updatedAt: true },
  })

  if (!workspace) {
    return new Response('Not Found', { status: 404 })
  }

  const baseUrl = `${APP_URL}/${slug}/help`

  // Fetch published articles joined with their collection slug so we can
  // build the full /{workspace}/help/{collection}/{article} URL in one pass.
  const [articles, collections] = await Promise.all([
    prisma.article.findMany({
      where: {
        workspaceId: workspace.id,
        status: 'PUBLISHED',
        collection: { isPublic: true, isArchived: false },
      },
      select: {
        slug: true,
        updatedAt: true,
        collection: { select: { slug: true } },
      },
    }),
    prisma.collection.findMany({
      where: {
        workspaceId: workspace.id,
        isPublic: true,
        isArchived: false,
      },
      select: {
        slug: true,
      },
    }),
  ])

  const entries: SitemapEntry[] = []

  // Help center root — highest priority
  entries.push({
    loc: baseUrl,
    lastmod: toLastmod(workspace.updatedAt),
    priority: '1.0',
  })

  // Collection index pages
  for (const col of collections) {
    entries.push({
      loc: `${baseUrl}/${col.slug}`,
      lastmod: toLastmod(workspace.updatedAt),
      priority: '0.6',
    })
  }

  // Individual article pages
  for (const article of articles) {
    entries.push({
      loc: `${baseUrl}/${article.collection.slug}/${article.slug}`,
      lastmod: toLastmod(article.updatedAt),
      priority: '0.8',
    })
  }

  const xml = buildSitemapXml(entries)

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
