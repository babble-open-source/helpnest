/**
 * GET /{workspace}/help/llms.txt
 *
 * Serves a machine-readable index of the workspace's help center per the
 * llms.txt specification (https://llmstxt.org). Designed to be fetched by
 * LLMs and AI assistants so they can discover and reference help content.
 *
 * Returns plain text, publicly cacheable for 5 minutes.
 * Returns HTTP 404 if the workspace slug does not exist.
 */
import { prisma } from '@/lib/db'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
const HELP_CENTER_DOMAIN = process.env.NEXT_PUBLIC_HELP_CENTER_DOMAIN

function getBaseUrl(slug: string): string {
  if (HELP_CENTER_DOMAIN) {
    return `https://${slug}.${HELP_CENTER_DOMAIN}`
  }
  return `${APP_URL}/${slug}/help`
}

export async function GET(
  _request: Request,
  { params: paramsPromise }: { params: Promise<{ workspace: string }> },
) {
  const { workspace: slug } = await paramsPromise

  // Resolve workspace and fetch all public, non-archived collections in one
  // query, including a published-article count and list of article titles/slugs
  // for the index section.
  const workspace = await prisma.workspace.findFirst({
    where: { slug },
    select: {
      id: true,
      name: true,
      metaDescription: true,
      collections: {
        where: { isPublic: true, isArchived: false },
        orderBy: { order: 'asc' },
        select: {
          title: true,
          slug: true,
          description: true,
          articles: {
            where: { status: 'PUBLISHED' },
            orderBy: { order: 'asc' },
            select: { title: true, slug: true },
          },
        },
      },
    },
  })

  if (!workspace) {
    return new Response('Not Found', { status: 404 })
  }

  const baseUrl = getBaseUrl(slug)

  // Collections that have at least one published article
  const collectionsWithArticles = workspace.collections.filter(
    (c) => c.articles.length > 0,
  )
  const totalArticles = collectionsWithArticles.reduce(
    (sum, c) => sum + c.articles.length,
    0,
  )
  const totalCollections = workspace.collections.length

  const description =
    workspace.metaDescription ??
    `Support docs, guides, and answers for ${workspace.name}.`

  // ── Build llms.txt body ───────────────────────────────────────────────────
  const lines: string[] = []

  lines.push(`# ${workspace.name} Help Center`)
  lines.push('')
  lines.push(`> ${description}`)
  lines.push('')
  lines.push(
    `This help center contains ${totalArticles} article${totalArticles !== 1 ? 's' : ''} across ${totalCollections} collection${totalCollections !== 1 ? 's' : ''}.`,
  )
  lines.push('')

  if (collectionsWithArticles.length > 0) {
    lines.push('## Collections')
    lines.push('')
    for (const col of collectionsWithArticles) {
      const colUrl = `${baseUrl}/${col.slug}`
      const descPart = col.description ? `: ${col.description}` : ''
      lines.push(`- [${col.title}](${colUrl})${descPart}`)
      for (const article of col.articles) {
        const articleUrl = `${baseUrl}/${col.slug}/${article.slug}`
        lines.push(`  - [${article.title}](${articleUrl})`)
      }
    }
    lines.push('')
  }

  lines.push('## Full Content')
  lines.push('')
  lines.push('For complete knowledge base content, see:')
  lines.push(`[llms-full.txt](${baseUrl}/llms-full.txt)`)

  const body = lines.join('\n')

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
