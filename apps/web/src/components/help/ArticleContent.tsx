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
 * Code blocks between list items are emitted OUTSIDE the list to avoid invalid
 * HTML (<pre> inside <ol>). For ordered lists the <ol start="N"> attribute keeps
 * the counter continuous across the split segments.
 */
function groupListItems(text: string): string {
  const lines = text.split('\n')
  const result: string[] = []
  let mode: 'ol' | 'ul' | null = null
  let buffer: string[] = []
  let olStart = 1  // start attribute for the next <ol> segment

  function countOlItemsInBuffer(): number {
    return buffer.filter(l => l.trim().startsWith('<li-ol')).length
  }

  function flush(keepMode = false) {
    if (!mode || buffer.length === 0) {
      if (!keepMode) { mode = null }
      buffer = []
      return
    }
    // Drop trailing blank lines so they don't create extra space inside the list.
    while (buffer.length > 0 && buffer[buffer.length - 1]!.trim() === '') buffer.pop()
    if (buffer.length === 0) { if (!keepMode) mode = null; return }
    const itemCount = countOlItemsInBuffer()
    const inner = buffer.join('\n')
      .replace(/li-ol/g, 'li')
      .replace(/li-ul/g, 'li')
    if (mode === 'ol') {
      result.push(`<ol class="list-decimal pl-5 my-4 space-y-2" start="${olStart}">${inner}</ol>`)
      olStart += itemCount
    } else {
      result.push(`<ul class="list-disc pl-5 my-4 space-y-1">${inner}</ul>`)
    }
    buffer = []
    if (!keepMode) mode = null
  }

  for (const line of lines) {
    const trimmed = line.trim()
    const isOlItem = trimmed.startsWith('<li-ol')
    const isUlItem = trimmed.startsWith('<li-ul')
    // eslint-disable-next-line no-control-regex
    const isCodeBlock = /^\x00CODE\d+\x00$/.test(trimmed)

    if (isOlItem) {
      if (mode === 'ul') { flush(); olStart = 1 }
      mode = 'ol'
      buffer.push(line)
    } else if (isUlItem) {
      if (mode === 'ol') flush()
      mode = 'ul'
      buffer.push(line)
    } else if (isCodeBlock && mode) {
      // Flush the list segment so far, emit the code block outside the list,
      // then keep mode active so subsequent items continue the sequence.
      flush(/* keepMode */ true)
      result.push(line)
    } else if (trimmed === '' && mode) {
      buffer.push(line)
    } else {
      flush()
      olStart = 1
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
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text: string, href: string) => {
      // Only allow http/https and root-relative links — block javascript:, vbscript:, data: etc.
      const safeHref = /^(https?:\/\/|\/)/.test(href) ? href : '#'
      return `<a href="${safeHref}" class="text-accent hover:underline" target="_blank" rel="noopener">${text}</a>`
    })

  // ── 4. Group list items ─────────────────────────────────────────────────────
  // Must run before paragraph wrapping so <ol>/<ul> containers are known.
  out = groupListItems(out)

  // ── 5. Paragraph wrapping ───────────────────────────────────────────────────
  // eslint-disable-next-line no-control-regex
  out = out.replace(/\n\n(?!<[uod]|<table|<h[1-6]|<hr|<blockquote|\x00CODE)/g, '</p><p class="text-ink/90 leading-7 my-4">')
  // eslint-disable-next-line no-control-regex
  out = out.replace(/^(?!<[h1-6uod]|<table|<hr|<blockquote|\x00CODE)(.+)/, '<p class="text-ink/90 leading-7 my-4">$1')
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

/**
 * Tiptap splits a numbered list interrupted by code blocks into separate <ol>
 * elements (because <pre> is not valid inside <ol>). Each new <ol> resets to 1.
 * This function adds start="N" to continuation segments so the counter is continuous.
 *
 * Two <ol> blocks are treated as one sequence when only <pre> elements (and
 * whitespace) appear between them. Any other block element resets the counter.
 */
export function fixOrderedListCounters(html: string): string {
  // Tokenise into <ol>…</ol>, <pre>…</pre>, and everything else.
  // Non-greedy match is safe here because Tiptap never nests <ol> inside <ol>
  // at the same level when code blocks interrupt the list.
  const tokenRe = /(<ol\b[\s\S]*?<\/ol>|<pre\b[\s\S]*?<\/pre>)/g
  const parts: string[] = []
  let lastIndex = 0
  let olCounter = 1
  let prevType: 'ol' | 'pre' | 'other' = 'other'

  let m: RegExpExecArray | null
  while ((m = tokenRe.exec(html)) !== null) {
    const before = html.slice(lastIndex, m.index)
    lastIndex = m.index + m[0].length

    // Text/markup between tokens — only whitespace is allowed without breaking the sequence
    if (before.trim() !== '') {
      prevType = 'other'
      olCounter = 1
    }
    parts.push(before)

    const token = m[0]!
    if (token.startsWith('<ol')) {
      const liCount = (token.match(/<li\b/g) ?? []).length
      const continuing = prevType === 'ol' || prevType === 'pre'

      if (continuing && olCounter > 1) {
        parts.push(token.replace(/^<ol\b/, `<ol start="${olCounter}"`))
      } else {
        olCounter = 1   // fresh sequence
        parts.push(token)
      }
      olCounter += liCount
      prevType = 'ol'
    } else {
      // <pre> block — doesn't break the sequence
      parts.push(token)
      prevType = 'pre'
    }
  }
  parts.push(html.slice(lastIndex))
  return parts.join('')
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

/** Wrap bare Tiptap <table> elements in a scroll container for mobile. */
function wrapTiptapTables(html: string): string {
  return html.replace(/<table\b/g, '<div class="overflow-x-auto my-5 table-scroll"><table ').replace(/<\/table>/g, '</table></div>')
}

export function ArticleContent({ content }: Props) {
  // Tiptap saves HTML (starts with `<`); seed/legacy data is Markdown.
  const isTiptap = content.trimStart().startsWith('<')
  const html = isTiptap
    ? wrapTiptapTables(fixOrderedListCounters(addHeadingIds(content)))
    : renderMarkdown(content)
  return (
    <div
      className="article-prose hn-prose"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
