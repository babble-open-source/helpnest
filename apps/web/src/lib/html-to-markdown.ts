/**
 * Zero-dependency HTML-to-Markdown converter for Tiptap output.
 *
 * Tiptap saves article content as HTML (starts with `<`). Legacy / seed data
 * is already Markdown and does not start with `<`. This module detects which
 * format is in use and only processes HTML; Markdown is returned unchanged.
 *
 * Design principles:
 * - Handles exactly the HTML that Tiptap emits for HelpNest articles.
 * - No dependencies — keeps the server bundle lean and avoids additional
 *   entries in `serverExternalPackages`.
 * - Code blocks are extracted first so their content is never corrupted by
 *   subsequent inline-mark substitutions (the classic regex-on-HTML pitfall).
 * - List nesting is handled via recursion rather than flat regex replacement.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '')
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

/** Return the value of a named HTML attribute, or null if absent. */
function getAttr(attrs: string, name: string): string | null {
  // Handles both quoted forms: name="val" and name='val'
  const re = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i')
  const m = attrs.match(re)
  return m ? (m[1] ?? m[2] ?? null) : null
}

// ---------------------------------------------------------------------------
// Inline conversion
// Operates on a fragment of HTML that contains no block-level children.
// ---------------------------------------------------------------------------

function convertInline(html: string): string {
  let out = html

  // Task-list checkboxes — Tiptap renders <input type="checkbox" checked> or
  // <input type="checkbox"> inside task-list <li> elements.
  out = out.replace(/<input[^>]*\bchecked\b[^>]*>/gi, '[x]')
  out = out.replace(/<input[^>]*\btype="checkbox"[^>]*/gi, '[ ]')

  // Images — handle both attribute orderings.
  out = out.replace(/<img([^>]*)>/gi, (_m, attrs: string) => {
    const src = getAttr(attrs, 'src') ?? ''
    const alt = getAttr(attrs, 'alt') ?? ''
    return `![${alt}](${src})`
  })

  // Bold + italic combined must come before each individually.
  out = out.replace(/<strong[^>]*><em[^>]*>([\s\S]*?)<\/em><\/strong>/gi, '***$1***')
  out = out.replace(/<em[^>]*><strong[^>]*>([\s\S]*?)<\/strong><\/em>/gi, '***$1***')

  // Bold
  out = out.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/(strong|b)>/gi, (_m, _t, inner: string) => `**${inner}**`)

  // Italic
  out = out.replace(/<(em|i)[^>]*>([\s\S]*?)<\/(em|i)>/gi, (_m, _t, inner: string) => `*${inner}*`)

  // Strikethrough
  out = out.replace(/<(s|del)[^>]*>([\s\S]*?)<\/(s|del)>/gi, (_m, _t, inner: string) => `~~${inner}~~`)

  // Inline code — decode entities inside backtick spans so raw text is preserved.
  out = out.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (_m, inner: string) => {
    return '`' + decodeEntities(stripTags(inner)) + '`'
  })

  // Links
  out = out.replace(/<a([^>]*)>([\s\S]*?)<\/a>/gi, (_m, attrs: string, inner: string) => {
    const href = getAttr(attrs, 'href') ?? '#'
    return `[${stripTags(inner).trim()}](${href})`
  })

  // Line breaks
  out = out.replace(/<br\s*\/?>/gi, '\n')

  // Strip remaining tags, then decode entities in the final text.
  out = decodeEntities(stripTags(out))

  return out
}

// ---------------------------------------------------------------------------
// List conversion (recursive for nesting)
// ---------------------------------------------------------------------------

function convertList(html: string, depth: number): string {
  const isOrdered = /^<ol\b/i.test(html.trimStart())

  // Extract all top-level <li> elements without descending into nested lists.
  // We process the inner HTML of the <ul>/<ol> element.
  const outerMatch = html.match(/^<(?:ul|ol)[^>]*>([\s\S]*)<\/(?:ul|ol)>$/i)
  if (!outerMatch) return ''

  const inner = outerMatch[1]!
  const indent = '  '.repeat(depth)
  const lines: string[] = []
  let counter = 1

  // Extract the start attribute for ordered lists.
  const startMatch = html.match(/<ol[^>]*\bstart="(\d+)"/)
  if (startMatch) counter = parseInt(startMatch[1]!, 10)

  // Walk through <li> elements. We split on top-level <li> opens so that
  // nested list content is carried through with the parent item.
  const liRe = /<li([^>]*)>([\s\S]*?)<\/li>/gi
  let m: RegExpExecArray | null

  while ((m = liRe.exec(inner)) !== null) {
    const liAttrs = m[1] ?? ''
    let liContent = m[2]!

    // Detect task-list checkbox state from data-checked or from an <input>
    const dataChecked = getAttr(liAttrs, 'data-checked')
    let checkboxPrefix = ''
    if (dataChecked !== null) {
      checkboxPrefix = dataChecked === 'true' ? '[x] ' : '[ ] '
      liContent = liContent.replace(/<input[^>]*>/gi, '')
    } else if (/<input[^>]*type="checkbox"[^>]*>/i.test(liContent)) {
      checkboxPrefix = /<input[^>]*\bchecked\b[^>]*>/i.test(liContent) ? '[x] ' : '[ ] '
      liContent = liContent.replace(/<input[^>]*>/gi, '')
    }

    // Separate nested lists from the rest of the item content so they get
    // their own indented lines below the parent bullet.
    const nestedListRe = /<(ul|ol)\b[\s\S]*?<\/\1>/gi
    const nestedLists: string[] = []
    const inlineContent = liContent.replace(nestedListRe, (nested) => {
      nestedLists.push(nested)
      return ''
    })

    // Strip the Tiptap <p> wrapper that wraps paragraph content inside <li>.
    const cleanedInline = inlineContent.replace(/<\/?p[^>]*>/gi, ' ').trim()
    const inlineText = convertInline(cleanedInline).trim()

    const marker = isOrdered ? `${counter}.` : '-'
    lines.push(`${indent}${marker} ${checkboxPrefix}${inlineText}`)

    // Recursively convert any nested lists, indented one level deeper.
    for (const nested of nestedLists) {
      const nestedMd = convertList(nested, depth + 1)
      if (nestedMd) lines.push(nestedMd)
    }

    if (isOrdered) counter++
  }

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Table conversion
// ---------------------------------------------------------------------------

function convertTable(html: string): string {
  const rows: string[][] = []

  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  let rowMatch: RegExpExecArray | null
  while ((rowMatch = rowRe.exec(html)) !== null) {
    const cells: string[] = []
    const cellRe = /<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi
    let cellMatch: RegExpExecArray | null
    while ((cellMatch = cellRe.exec(rowMatch[1]!)) !== null) {
      // Tiptap wraps cell content in <p> tags — collapse them to spaces.
      const cellHtml = cellMatch[1]!.replace(/<\/?p[^>]*>/gi, ' ')
      cells.push(convertInline(cellHtml).trim())
    }
    if (cells.length > 0) rows.push(cells)
  }

  if (rows.length === 0) return ''

  const colCount = Math.max(...rows.map((r) => r.length))
  const pad = (row: string[]) => {
    const out = [...row]
    while (out.length < colCount) out.push('')
    return out
  }

  const renderRow = (cells: string[]) => `| ${pad(cells).join(' | ')} |`
  const separator = Array.from({ length: colCount }, () => '---')

  const header = rows[0]!
  const body = rows.slice(1)

  return [renderRow(header), renderRow(separator), ...body.map(renderRow)].join('\n')
}

// ---------------------------------------------------------------------------
// Block conversion
// Processes one pass over the HTML, extracting code blocks first so that
// inline substitutions never corrupt code content.
// ---------------------------------------------------------------------------

function convertBlocks(html: string): string[] {
  // ── Step 1: Extract fenced code blocks ───────────────────────────────────
  // Must happen before any other substitution to protect code content.
  const codeSlots: string[] = []
  let work = html.replace(
    /<pre[^>]*>[\s\S]*?<code([^>]*)>([\s\S]*?)<\/code>[\s\S]*?<\/pre>/gi,
    (_m, codeAttrs: string, code: string) => {
      const langMatch = codeAttrs.match(/\blanguage-([a-z0-9]+)/)
      const lang = langMatch ? langMatch[1]! : ''
      const raw = decodeEntities(stripTags(code)).trim()
      const slot = `\x00CODE${codeSlots.length}\x00`
      codeSlots.push('```' + lang + '\n' + raw + '\n```')
      return slot
    }
  )

  // ── Step 2: Block-level substitutions ────────────────────────────────────

  // Headings
  for (let i = 1; i <= 6; i++) {
    const prefix = '#'.repeat(i)
    work = work.replace(
      new RegExp(`<h${i}[^>]*>([\\s\\S]*?)<\\/h${i}>`, 'gi'),
      (_m, inner: string) => `\x00BLOCK\x00${prefix} ${convertInline(inner).trim()}\x00ENDBLOCK\x00`
    )
  }

  // Blockquote (recursive — may contain nested block elements)
  work = work.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_m, inner: string) => {
    const innerBlocks = convertBlocks(inner).join('\n\n')
    const quoted = innerBlocks
      .split('\n')
      .map((line) => `> ${line}`)
      .join('\n')
    return `\x00BLOCK\x00${quoted}\x00ENDBLOCK\x00`
  })

  // Tables
  work = work.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (_m, inner: string) => {
    const md = convertTable(inner)
    return md ? `\x00BLOCK\x00${md}\x00ENDBLOCK\x00` : ''
  })

  // Lists — ordered before unordered so a nested <ul> inside an <ol> isn't
  // consumed by the outer unordered pass.
  // We process innermost lists first by repeatedly replacing until stable.
  // Because lists can be deeply nested, we loop until no more substitutions occur.
  let prev = ''
  while (prev !== work) {
    prev = work
    work = work.replace(/<(ul|ol)([^>]*)>([\s\S]*?)<\/\1>/gi, (_m, tag: string, attrs: string, inner: string) => {
      const fullList = `<${tag}${attrs}>${inner}</${tag}>`
      const md = convertList(fullList, 0)
      return md ? `\x00BLOCK\x00${md}\x00ENDBLOCK\x00` : ''
    })
  }

  // Horizontal rules
  work = work.replace(/<hr[^>]*\/?>/gi, '\x00BLOCK\x00---\x00ENDBLOCK\x00')

  // Images at block level
  work = work.replace(/<img([^>]*)>/gi, (_m, attrs: string) => {
    const src = getAttr(attrs, 'src') ?? ''
    const alt = getAttr(attrs, 'alt') ?? ''
    return `\x00BLOCK\x00![${alt}](${src})\x00ENDBLOCK\x00`
  })

  // Paragraphs
  work = work.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_m, inner: string) => {
    const text = convertInline(inner).trim()
    return text ? `\x00BLOCK\x00${text}\x00ENDBLOCK\x00` : ''
  })

  // Divs and other generic wrappers — recurse
  work = work.replace(/<div[^>]*>([\s\S]*?)<\/div>/gi, (_m, inner: string) => {
    const innerBlocks = convertBlocks(inner)
    return innerBlocks.length > 0
      ? `\x00BLOCK\x00${innerBlocks.join('\x00ENDBLOCK\x00\x00BLOCK\x00')}\x00ENDBLOCK\x00`
      : ''
  })

  // ── Step 3: Restore code block slots ─────────────────────────────────────
  codeSlots.forEach((block, i) => {
    work = work.replace(`\x00CODE${i}\x00`, `\x00BLOCK\x00${block}\x00ENDBLOCK\x00`)
  })

  // ── Step 4: Split on block boundaries and return non-empty blocks ─────────
  const blocks = work
    .split('\x00ENDBLOCK\x00')
    .map((chunk) => {
      // Each chunk may have a leading \x00BLOCK\x00 marker
      const text = chunk.replace(/\x00BLOCK\x00/g, '').trim()
      return text
    })
    .filter(Boolean)

  return blocks
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Convert Tiptap HTML (or legacy Markdown) to Markdown.
 *
 * If `content` does not start with `<` it is already Markdown and is returned
 * unchanged. Otherwise the HTML is converted to Markdown suitable for LLM
 * consumption (llms.txt, llms-full.txt).
 *
 * @param content - Raw article content string from the database.
 * @returns Clean Markdown string.
 */
export function htmlToMarkdown(content: string): string {
  if (!content) return ''

  // Already Markdown — seed data, legacy content, or plain text.
  if (!content.trimStart().startsWith('<')) return content

  const blocks = convertBlocks(content)

  return blocks
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
