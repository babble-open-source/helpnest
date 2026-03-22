import { prisma } from '@/lib/db'
import { locales } from '@/i18n/config'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
const HELP_CENTER_DOMAIN = process.env.NEXT_PUBLIC_HELP_CENTER_DOMAIN

function getBaseUrl(slug: string): string {
  if (HELP_CENTER_DOMAIN) {
    return `https://${slug}.${HELP_CENTER_DOMAIN}`
  }
  return `${APP_URL}/${slug}/help`
}

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

interface HreflangAlternate {
  hreflang: string
  href: string
}

interface SitemapEntry {
  loc: string
  lastmod: string
  priority: string
  alternates: HreflangAlternate[]
}

function buildSitemapXml(entries: SitemapEntry[]): string {
  const urls = entries
    .map(({ loc, lastmod, priority, alternates }) => {
      const hreflangTags = alternates
        .map(
          ({ hreflang, href }) =>
            `    <xhtml:link rel="alternate" hreflang="${xmlEscape(hreflang)}" href="${xmlEscape(href)}" />`,
        )
        .join('\n')
      return (
        `  <url>\n` +
        `    <loc>${xmlEscape(loc)}</loc>\n` +
        `    <lastmod>${lastmod}</lastmod>\n` +
        `    <priority>${priority}</priority>\n` +
        (hreflangTags ? `${hreflangTags}\n` : '') +
        `  </url>`
      )
    })
    .join('\n')

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n` +
    `${urls}\n` +
    `</urlset>`
  )
}

export async function GET(
  _request: Request,
  { params: paramsPromise }: { params: Promise<{ workspace: string }> },
) {
  const params = await paramsPromise
  const { workspace: slug } = params

  const workspace = await prisma.workspace.findUnique({
    where: { slug, deletedAt: null },
    select: { id: true, updatedAt: true },
  })

  if (!workspace) {
    return new Response('Not Found', { status: 404 })
  }

  const baseUrl = getBaseUrl(slug)

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
    alternates: locales.map((l) => ({
      hreflang: l,
      href: HELP_CENTER_DOMAIN
        ? `${baseUrl}/${l}`
        : `${APP_URL}/${l}/${slug}/help`,
    })),
  })

  // Collection index pages
  for (const col of collections) {
    entries.push({
      loc: `${baseUrl}/${col.slug}`,
      lastmod: toLastmod(workspace.updatedAt),
      priority: '0.6',
      alternates: locales.map((l) => ({
        hreflang: l,
        href: HELP_CENTER_DOMAIN
          ? `${baseUrl}/${l}/${col.slug}`
          : `${APP_URL}/${l}/${slug}/help/${col.slug}`,
      })),
    })
  }

  // Individual article pages
  for (const article of articles) {
    entries.push({
      loc: `${baseUrl}/${article.collection.slug}/${article.slug}`,
      lastmod: toLastmod(article.updatedAt),
      priority: '0.8',
      alternates: locales.map((l) => ({
        hreflang: l,
        href: HELP_CENTER_DOMAIN
          ? `${baseUrl}/${l}/${article.collection.slug}/${article.slug}`
          : `${APP_URL}/${l}/${slug}/help/${article.collection.slug}/${article.slug}`,
      })),
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
