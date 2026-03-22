import { NextResponse } from 'next/server'
import { Client } from '@notionhq/client'
import { requireAuth } from '@/lib/auth-api'
import { prisma } from '@/lib/db'
import { uniqueCollectionSlug, uniqueArticleSlug } from '@/lib/unique-slug'

// ── Notion rich-text → Tiptap HTML ───────────────────────────────────────────

interface RichTextAnnotations {
  bold?: boolean
  italic?: boolean
  strikethrough?: boolean
  underline?: boolean
  code?: boolean
  color?: string
}

interface RichTextItem {
  type?: string
  plain_text?: string
  text?: { content: string; link?: { url: string } | null }
  mention?: unknown
  equation?: { expression: string }
  annotations?: RichTextAnnotations
  href?: string | null
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function richTextToHtml(richText: RichTextItem[]): string {
  return richText
    .map((item) => {
      const text = item.plain_text ?? item.text?.content ?? ''
      if (!text) return ''

      let html = escapeHtml(text).replace(/\n/g, '<br>')

      const a = item.annotations ?? {}
      // Apply inline formatting innermost-first
      if (a.code) html = `<code>${html}</code>`
      if (a.bold && a.italic) html = `<strong><em>${html}</em></strong>`
      else if (a.bold) html = `<strong>${html}</strong>`
      else if (a.italic) html = `<em>${html}</em>`
      if (a.strikethrough) html = `<s>${html}</s>`
      if (a.underline) html = `<u>${html}</u>`

      // Wrap links (from rich text href or text.link)
      const href = item.href ?? item.text?.link?.url
      if (href) html = `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${html}</a>`

      return html
    })
    .join('')
}

// ── Block type interfaces ─────────────────────────────────────────────────────

interface BlockRichText {
  rich_text: RichTextItem[]
}

interface BlockCode extends BlockRichText {
  language?: string
}

interface BlockTodo extends BlockRichText {
  checked?: boolean
}

interface BlockImage {
  type: 'external' | 'file'
  external?: { url: string }
  file?: { url: string }
  caption?: RichTextItem[]
}

interface BlockCallout extends BlockRichText {
  icon?: { type: string; emoji?: string }
}

interface BlockEmbed {
  url?: string
  caption?: RichTextItem[]
}

/** Extract YouTube video ID from any youtube.com / youtu.be URL. Returns null for non-YouTube URLs. */
function youtubeId(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('?')[0] ?? null
    if (u.hostname.includes('youtube.com')) {
      const v = u.searchParams.get('v')
      if (v) return v
      // Handle /embed/VIDEO_ID and /shorts/VIDEO_ID
      const parts = u.pathname.split('/')
      const embedIdx = parts.indexOf('embed')
      if (embedIdx !== -1) return parts[embedIdx + 1] ?? null
      const shortsIdx = parts.indexOf('shorts')
      if (shortsIdx !== -1) return parts[shortsIdx + 1] ?? null
    }
  } catch {
    // ignore malformed URLs
  }
  return null
}

/** Render a YouTube embed in Tiptap's data-youtube-video format (nocookie). */
function youtubeEmbed(videoId: string): string {
  const src = `https://www.youtube-nocookie.com/embed/${videoId}`
  return `<div data-youtube-video><iframe src="${src}" width="640" height="360" allowfullscreen frameborder="0"></iframe></div>`
}

interface NotionBlock {
  id: string
  object: string
  type: string
  has_children?: boolean
}

type BlockData = Record<string, BlockRichText | BlockCode | BlockTodo | BlockImage | BlockCallout>

// ── Blocks → Tiptap HTML ──────────────────────────────────────────────────────
// Consecutive list items of the same type are grouped into one <ul>/<ol>.

function notionBlocksToHTML(blocks: NotionBlock[]): string {
  const parts: string[] = []
  let i = 0

  while (i < blocks.length) {
    const block = blocks[i]!
    const data = (block as unknown as BlockData)[block.type]

    switch (block.type) {
      case 'paragraph': {
        const inner = richTextToHtml((data as BlockRichText).rich_text ?? [])
        parts.push(inner ? `<p>${inner}</p>` : '<p></p>')
        i++
        break
      }

      case 'heading_1': {
        parts.push(`<h1>${richTextToHtml((data as BlockRichText).rich_text ?? [])}</h1>`)
        i++
        break
      }
      case 'heading_2': {
        parts.push(`<h2>${richTextToHtml((data as BlockRichText).rich_text ?? [])}</h2>`)
        i++
        break
      }
      case 'heading_3': {
        parts.push(`<h3>${richTextToHtml((data as BlockRichText).rich_text ?? [])}</h3>`)
        i++
        break
      }

      // Bulleted list — collect consecutive items into one <ul>
      case 'bulleted_list_item': {
        const items: string[] = []
        while (i < blocks.length && blocks[i]!.type === 'bulleted_list_item') {
          const d = (blocks[i]! as unknown as BlockData)['bulleted_list_item'] as BlockRichText
          items.push(`<li><p>${richTextToHtml(d.rich_text ?? [])}</p></li>`)
          i++
        }
        parts.push(`<ul>${items.join('')}</ul>`)
        break
      }

      // Numbered list — collect consecutive items into one <ol>
      case 'numbered_list_item': {
        const items: string[] = []
        while (i < blocks.length && blocks[i]!.type === 'numbered_list_item') {
          const d = (blocks[i]! as unknown as BlockData)['numbered_list_item'] as BlockRichText
          items.push(`<li><p>${richTextToHtml(d.rich_text ?? [])}</p></li>`)
          i++
        }
        parts.push(`<ol>${items.join('')}</ol>`)
        break
      }

      // To-do list — Tiptap taskList
      case 'to_do': {
        const items: string[] = []
        while (i < blocks.length && blocks[i]!.type === 'to_do') {
          const d = (blocks[i]! as unknown as BlockData)['to_do'] as BlockTodo
          const checked = d.checked ? 'true' : 'false'
          items.push(
            `<li data-type="taskItem" data-checked="${checked}"><p>${richTextToHtml(d.rich_text ?? [])}</p></li>`,
          )
          i++
        }
        parts.push(`<ul data-type="taskList">${items.join('')}</ul>`)
        break
      }

      case 'quote': {
        const inner = richTextToHtml((data as BlockRichText).rich_text ?? [])
        parts.push(`<blockquote><p>${inner}</p></blockquote>`)
        i++
        break
      }

      case 'code': {
        const d = data as BlockCode
        const lang = d.language && d.language !== 'plain text' ? ` class="language-${escapeHtml(d.language)}"` : ''
        const code = escapeHtml((d.rich_text ?? []).map((t) => t.plain_text ?? '').join(''))
        parts.push(`<pre><code${lang}>${code}</code></pre>`)
        i++
        break
      }

      case 'divider': {
        parts.push('<hr>')
        i++
        break
      }

      case 'image': {
        const d = data as BlockImage
        const src = d.type === 'external' ? d.external?.url : d.file?.url
        const alt = d.caption ? richTextToHtml(d.caption) : ''
        if (src) {
          parts.push(`<img src="${escapeHtml(src)}" alt="${escapeHtml(alt.replace(/<[^>]+>/g, ''))}" />`)
          if (alt) parts.push(`<p><em>${alt}</em></p>`)
        }
        i++
        break
      }

      // Video block (YouTube or other external video)
      case 'video': {
        const d = data as BlockImage // same shape as image for external/file
        const url = d.type === 'external' ? d.external?.url : d.file?.url
        if (url) {
          const vid = youtubeId(url)
          if (vid) {
            parts.push(youtubeEmbed(vid))
          } else {
            // Non-YouTube video: render as a link
            parts.push(`<p><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a></p>`)
          }
        }
        i++
        break
      }

      // Embed block (YouTube iframes, generic embeds)
      case 'embed': {
        const d = data as BlockEmbed
        const url = d.url ?? ''
        if (url) {
          const vid = youtubeId(url)
          if (vid) {
            parts.push(youtubeEmbed(vid))
          } else {
            parts.push(`<p><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a></p>`)
          }
        }
        i++
        break
      }

      // Bookmark block — render as a link
      case 'bookmark': {
        const d = data as BlockEmbed
        const url = d.url ?? ''
        const caption = d.caption ? richTextToHtml(d.caption) : escapeHtml(url)
        if (url) parts.push(`<p><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${caption}</a></p>`)
        i++
        break
      }

      case 'callout': {
        const d = data as BlockCallout
        const emoji = d.icon?.type === 'emoji' ? `${d.icon.emoji} ` : ''
        const inner = richTextToHtml(d.rich_text ?? [])
        parts.push(`<blockquote><p>${escapeHtml(emoji)}${inner}</p></blockquote>`)
        i++
        break
      }

      // Toggle: render as bold summary line followed by content
      case 'toggle': {
        const inner = richTextToHtml((data as BlockRichText).rich_text ?? [])
        parts.push(`<p><strong>${inner}</strong></p>`)
        i++
        break
      }

      default: {
        // Unknown block — try to extract any plain text and render as paragraph
        const rt = (data as BlockRichText | undefined)?.rich_text
        if (rt?.length) {
          const inner = richTextToHtml(rt)
          if (inner) parts.push(`<p>${inner}</p>`)
        }
        i++
        break
      }
    }
  }

  return parts.join('')
}

// ── Notion page type interfaces ───────────────────────────────────────────────

interface NotionPageProperty {
  type: string
  title?: RichTextItem[]
}

interface NotionPage {
  object: string
  id: string
  parent:
    | { type: 'database_id'; database_id: string }
    | { type: 'page_id'; page_id: string }
    | { type: 'workspace'; workspace: boolean }
  properties: Record<string, NotionPageProperty>
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const auth = await requireAuth(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (auth.via === 'session' && auth.userId) {
    const member = await prisma.member.findFirst({
      where: { userId: auth.userId, workspaceId: auth.workspaceId, role: { in: ['OWNER', 'ADMIN', 'EDITOR'] } },
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

  const body = (await request.json()) as {
    token?: string
    databaseId?: string
    status?: 'DRAFT' | 'PUBLISHED'
  }

  const token = body.token?.trim()
  if (!token) return NextResponse.json({ error: 'Notion token is required' }, { status: 400 })

  const importStatus = body.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT'
  const errors: string[] = []
  let collectionsCreated = 0
  let articlesCreated = 0

  try {
    const notion = new Client({ auth: token })

    // ── Fetch pages ────────────────────────────────────────────────────────
    let pages: NotionPage[] = []

    if (body.databaseId?.trim()) {
      const dbId = body.databaseId.trim()
      let cursor: string | undefined
      for (;;) {
        const res = await notion.dataSources.query({ data_source_id: dbId, start_cursor: cursor, page_size: 100 })
        pages.push(...(res.results as unknown as NotionPage[]))
        if (!res.has_more) break
        cursor = res.next_cursor ?? undefined
      }
    } else {
      let cursor: string | undefined
      for (;;) {
        const res = await notion.search({ filter: { property: 'object', value: 'page' }, start_cursor: cursor, page_size: 100 })
        pages.push(...(res.results as unknown as NotionPage[]).filter((p) => p.object === 'page'))
        if (!res.has_more) break
        cursor = res.next_cursor ?? undefined
      }
    }

    // ── Collection map (parent database → HelpNest collection) ────────────
    const collectionMap = new Map<string, string>()
    const dbTitleCache = new Map<string, string>()

    async function getOrCreateCollection(parentKey: string, name: string): Promise<string> {
      if (collectionMap.has(parentKey)) return collectionMap.get(parentKey)!
      const slug = await uniqueCollectionSlug(name, workspaceId)
      const col = await prisma.collection.create({
        data: { workspaceId, title: name, slug, emoji: '📥', description: 'Imported from Notion' },
      })
      collectionsCreated++
      collectionMap.set(parentKey, col.id)
      return col.id
    }

    async function getDbTitle(databaseId: string): Promise<string> {
      if (dbTitleCache.has(databaseId)) return dbTitleCache.get(databaseId)!
      try {
        const db = await notion.databases.retrieve({ database_id: databaseId })
        const title = (db as unknown as { title?: RichTextItem[] }).title?.map((t) => t.plain_text ?? '').join('').trim() || 'Notion Database'
        dbTitleCache.set(databaseId, title)
        return title
      } catch {
        return 'Notion Database'
      }
    }

    // ── Import each page ───────────────────────────────────────────────────
    for (const page of pages) {
      if (page.object !== 'page') continue

      try {
        // Extract title
        let title = 'Untitled'
        for (const prop of Object.values(page.properties)) {
          if (prop.type === 'title' && prop.title?.length) {
            title = prop.title.map((t) => t.plain_text ?? '').join('').trim() || 'Untitled'
            break
          }
        }

        // Determine collection
        let parentKey = 'notion-import'
        let collectionName = 'Notion Import'
        if (page.parent.type === 'database_id') {
          parentKey = `db-${page.parent.database_id}`
          collectionName = await getDbTitle(page.parent.database_id)
        }

        const collectionId = await getOrCreateCollection(parentKey, collectionName)

        // Fetch blocks and convert to Tiptap HTML
        let content = ''
        try {
          const allBlocks: NotionBlock[] = []
          let blockCursor: string | undefined
          for (;;) {
            const res = await notion.blocks.children.list({ block_id: page.id, start_cursor: blockCursor, page_size: 100 })
            allBlocks.push(...(res.results as unknown as NotionBlock[]))
            if (!res.has_more) break
            blockCursor = res.next_cursor ?? undefined
          }
          content = notionBlocksToHTML(allBlocks)
        } catch {
          content = ''
        }

        // Plain-text excerpt (first 160 chars)
        const excerpt = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160)

        const articleSlug = await uniqueArticleSlug(title, workspaceId)
        await prisma.article.create({
          data: {
            workspaceId,
            collectionId,
            authorId,
            title,
            slug: articleSlug,
            content,
            excerpt,
            status: importStatus,
            ...(importStatus === 'PUBLISHED' ? { publishedAt: new Date() } : {}),
          },
        })
        articlesCreated++
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push(`"${(page as unknown as { properties?: { title?: { title?: Array<{ plain_text?: string }> } } }).properties?.title?.title?.[0]?.plain_text ?? page.id}": ${msg}`)
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const isUnauthorized = msg.toLowerCase().includes('unauthorized') || msg.toLowerCase().includes('api token is invalid')
    if (isUnauthorized) {
      return NextResponse.json(
        {
          error:
            'Notion rejected the token. Make sure you: (1) copied the full token starting with ntn_ or secret_, (2) created an Internal Integration at notion.so/profile/integrations/internal, and (3) shared the relevant pages/databases with your integration.',
        },
        { status: 502 },
      )
    }
    return NextResponse.json({ error: `Notion API error: ${msg}` }, { status: 502 })
  }

  return NextResponse.json({ collectionsCreated, articlesCreated, errors })
}
