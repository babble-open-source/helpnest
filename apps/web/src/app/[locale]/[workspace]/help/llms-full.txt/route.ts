/**
 * GET /{workspace}/help/llms-full.txt
 *
 * Serves the complete content of every published help article as Markdown,
 * grouped by collection. Intended for LLM ingestion — provides the full
 * knowledge base in a single, cacheable plain-text response.
 *
 * Article content is stored as either Tiptap HTML (starts with `<`) or
 * legacy Markdown. Both are normalised to Markdown via htmlToMarkdown().
 *
 * Returns plain text, publicly cacheable for 10 minutes.
 * Returns HTTP 404 if the workspace slug does not exist.
 */
import { prisma } from '@/lib/db'
import { htmlToMarkdown } from '@/lib/html-to-markdown'

export async function GET(
  _request: Request,
  { params: paramsPromise }: { params: Promise<{ workspace: string }> },
) {
  const { workspace: slug } = await paramsPromise

  const workspace = await prisma.workspace.findUnique({
    where: { slug, deletedAt: null },
    select: {
      id: true,
      name: true,
      collections: {
        where: { isPublic: true, isArchived: false },
        orderBy: { order: 'asc' },
        select: {
          title: true,
          slug: true,
          articles: {
            where: { status: 'PUBLISHED' },
            orderBy: { order: 'asc' },
            select: {
              title: true,
              slug: true,
              content: true,
            },
          },
        },
      },
    },
  })

  if (!workspace) {
    return new Response('Not Found', { status: 404 })
  }

  // Filter to collections that contain at least one published article so we
  // don't emit empty section headers.
  const collectionsWithArticles = workspace.collections.filter(
    (c) => c.articles.length > 0,
  )

  // ── Build llms-full.txt body ──────────────────────────────────────────────
  const lines: string[] = []

  lines.push(`# ${workspace.name} Help Center — Full Content`)

  for (const col of collectionsWithArticles) {
    lines.push('')
    lines.push(`## ${col.title}`)

    for (const article of col.articles) {
      lines.push('')
      lines.push(`### ${article.title}`)
      lines.push('')

      const markdown = htmlToMarkdown(article.content)
      if (markdown) {
        lines.push(markdown)
      }

      lines.push('')
      lines.push('---')
    }
  }

  // Trim the trailing `---` separator after the last article so the document
  // ends cleanly.
  while (lines.length > 0 && lines[lines.length - 1]!.trim() === '---') {
    lines.pop()
  }

  const body = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=600',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
