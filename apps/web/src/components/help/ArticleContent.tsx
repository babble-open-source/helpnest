'use client'

interface Props {
  content: string
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Group consecutive <li-ol> / <li-ul> markers into proper <ol> / <ul> containers.
 *
 * Works line-by-line so that code block placeholders (\x00CODEn\x00) and blank
 * lines that appear *between* list items are absorbed into the same list rather
 * than breaking it into separate single-item lists — which would reset the
 * counter to 1 for every item.
 */
function groupListItems(text: string): string {
  const lines = text.split('\n')
  const result: string[] = []
  let mode: 'ol' | 'ul' | null = null
  let buffer: string[] = []

  function flush() {
    if (!mode || buffer.length === 0) { mode = null; buffer = []; return }
    // Drop trailing blank lines so they don't create extra space inside the list.
    while (buffer.length > 0 && buffer[buffer.length - 1]!.trim() === '') buffer.pop()
    const inner = buffer.join('\n')
      .replace(/li-ol/g, 'li')
      .replace(/li-ul/g, 'li')
    result.push(
      mode === 'ol'
        ? `<ol class="list-decimal pl-5 my-4 space-y-2">${inner}</ol>`
        : `<ul class="list-disc pl-5 my-4 space-y-1">${inner}</ul>`
    )
    mode = null
    buffer = []
  }

  for (const line of lines) {
    const trimmed = line.trim()
    const isOlItem = trimmed.startsWith('<li-ol')
    const isUlItem = trimmed.startsWith('<li-ul')
    // Code block placeholder or blank line — keep inside an active list
    const isContinuation = /^\x00CODE\d+\x00$/.test(trimmed) || trimmed === ''

    if (isOlItem) {
      if (mode === 'ul') flush()
      mode = 'ol'
      buffer.push(line)
    } else if (isUlItem) {
      if (mode === 'ol') flush()
      mode = 'ul'
      buffer.push(line)
    } else if (mode && isContinuation) {
      buffer.push(line)
    } else {
      flush()
      result.push(line)
    }
  }
  flush()

  return result.join('\n')
}

function renderMarkdown(md: string): string {
  // ── 1. Extract fenced code blocks ──────────────────────────────────────────
  // Replace before any other processing so paragraph / list logic never sees
  // the raw content inside code fences.
  const codeBlocks: string[] = []
  let out = md.replace(/```(\w*)\n?([\s\S]*?)```/g, (_match, _lang, code) => {
    codeBlocks.push(
      `<pre class="bg-ink text-cream rounded-lg p-4 overflow-x-auto my-5"><code class="text-sm font-mono">${escapeHtml(code.trim())}</code></pre>`
    )
    return `\x00CODE${codeBlocks.length - 1}\x00`
  })

  // ── 2. Tables ───────────────────────────────────────────────────────────────
  out = out.replace(/^\|(.+)\|\n\|[-| :]+\|\n((?:\|.+\|\n?)+)/gm, (match) => {
    const rows = match.trim().split('\n')
    const headers = (rows[0] ?? '')
      .split('|').filter(c => c.trim())
      .map(c => `<th class="px-4 py-2 text-left font-semibold text-sm text-ink border-b border-border">${c.trim()}</th>`)
    const bodyRows = rows.slice(2).map(row => {
      const cells = row.split('|').filter(c => c.trim())
        .map(c => `<td class="px-4 py-2 text-sm text-ink/90 border-b border-border/50">${c.trim()}</td>`)
      return `<tr>${cells.join('')}</tr>`
    })
    return (
      `<div class="overflow-x-auto my-5">` +
        `<table class="w-full border border-border rounded-lg overflow-hidden">` +
          `<thead><tr>${headers.join('')}</tr></thead>` +
          `<tbody>${bodyRows.join('')}</tbody>` +
        `</table>` +
      `</div>`
    )
  })

  // ── 3. Block and inline elements ────────────────────────────────────────────
  out = out
    .replace(/^### (.+)$/gm, (_, t) => {
      const id = t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      return `<h3 id="${id}" class="font-serif text-xl text-ink mt-8 mb-3 scroll-mt-20">${t}</h3>`
    })
    .replace(/^## (.+)$/gm, (_, t) => {
      const id = t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      return `<h2 id="${id}" class="font-serif text-2xl text-ink mt-10 mb-4 scroll-mt-20">${t}</h2>`
    })
    .replace(/^# (.+)$/gm, (_, t) => {
      const id = t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      return `<h1 id="${id}" class="font-serif text-3xl text-ink mt-10 mb-4 scroll-mt-20">${t}</h1>`
    })
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-ink">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="bg-cream border border-border rounded px-1.5 py-0.5 text-sm font-mono text-accent">$1</code>')
    .replace(/^> (.+)$/gm, '<blockquote class="border-l-4 border-accent pl-4 text-muted italic my-4">$1</blockquote>')
    // Temp markers — replaced by groupListItems below
    .replace(/^[-*] (.+)$/gm, '<li-ul class="text-ink/90 my-1">$1</li-ul>')
    .replace(/^\d+\. (.+)$/gm, '<li-ol class="text-ink/90 my-1">$1</li-ol>')
    .replace(/^---$/gm, '<hr class="border-border my-8" />')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-accent hover:underline" target="_blank" rel="noopener">$1</a>')

  // ── 4. Group list items ─────────────────────────────────────────────────────
  // Must run before paragraph wrapping so <ol>/<ul> containers are known.
  out = groupListItems(out)

  // ── 5. Paragraph wrapping ───────────────────────────────────────────────────
  out = out
    .replace(/\n\n(?!<[uod]|<table|<h[1-6]|<hr|<blockquote|\x00CODE)/g, '</p><p class="text-ink/90 leading-7 my-4">')
    .replace(/^(?!<[h1-6uod]|<table|<hr|<blockquote|\x00CODE)(.+)/, '<p class="text-ink/90 leading-7 my-4">$1')
  out = out + '</p>'
  out = out.replace(/<p[^>]*><\/p>/g, '')

  // ── 6. Restore code blocks ──────────────────────────────────────────────────
  codeBlocks.forEach((block, i) => {
    out = out.replace(`\x00CODE${i}\x00`, block)
  })

  return out
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

/** Add id attributes to <h1>–<h3> in Tiptap HTML so TOC anchor links work. */
function addHeadingIds(html: string): string {
  return html.replace(/<h([1-3])([^>]*)>([\s\S]*?)<\/h[1-3]>/gi, (_match, level, attrs, inner) => {
    const text = inner.replace(/<[^>]+>/g, '').trim()
    const id = slugify(text)
    // Don't double-add if an id is already present
    if (/\bid=/.test(attrs)) return _match
    return `<h${level}${attrs} id="${id}">${inner}</h${level}>`
  })
}

export function ArticleContent({ content }: Props) {
  // Tiptap saves HTML (starts with `<`); seed/legacy data is Markdown.
  const isTiptap = content.trimStart().startsWith('<')
  const html = isTiptap ? addHeadingIds(content) : renderMarkdown(content)
  return (
    <div
      className="article-prose text-ink/90 leading-7"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
