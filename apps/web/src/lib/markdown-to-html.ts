/**
 * Zero-dependency Markdown-to-HTML converter that emits Tiptap-compatible HTML.
 *
 * This is the exact inverse of html-to-markdown.ts. The HTML structure produced
 * matches what Tiptap emits so that articles created via the MCP/API with Markdown
 * content render correctly in the Classic editor and on the customer-facing widget.
 *
 * Key Tiptap HTML conventions that differ from generic HTML:
 * - List items wrap their text in <p>: <li><p>text</p></li>
 * - Table cells wrap their content in <p>: <th><p>text</p></th>, <td><p>text</p></td>
 *
 * If content already starts with '<' it is returned unchanged (already HTML).
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ---------------------------------------------------------------------------
// Inline conversion
// ---------------------------------------------------------------------------

function inline(text: string): string {
  let out = text

  // Inline code — protect content from further substitution
  const codeSlots: string[] = []
  out = out.replace(/`([^`]+)`/g, (_m, code: string) => {
    const slot = `\x00INLINE_CODE${codeSlots.length}\x00`
    codeSlots.push(`<code>${escapeHtml(code)}</code>`)
    return slot
  })

  // Images before links
  out = out.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt: string, src: string) =>
    `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}">`
  )

  // Links
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label: string, href: string) =>
    `<a href="${escapeHtml(href)}">${label}</a>`
  )

  // Bold + italic combined
  out = out.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')

  // Bold
  out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')

  // Italic
  out = out.replace(/\*(.+?)\*/g, '<em>$1</em>')

  // Strikethrough
  out = out.replace(/~~(.+?)~~/g, '<s>$1</s>')

  // Restore inline code slots
  codeSlots.forEach((code, i) => {
    out = out.replace(`\x00INLINE_CODE${i}\x00`, code)
  })

  return out
}

// ---------------------------------------------------------------------------
// Table parsing
// ---------------------------------------------------------------------------

function parseTable(headerLine: string, bodyLines: string[]): string {
  const parseRow = (row: string) =>
    row.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim())

  const headers = parseRow(headerLine)
  const headerCells = headers.map((h) => `<th><p>${inline(h)}</p></th>`).join('')

  const rows = bodyLines.map((row) => {
    const cells = parseRow(row)
    // Pad/trim to match header column count
    while (cells.length < headers.length) cells.push('')
    return `<tr>${cells.slice(0, headers.length).map((c) => `<td><p>${inline(c)}</p></td>`).join('')}</tr>`
  })

  return `<table><thead><tr>${headerCells}</tr></thead><tbody>${rows.join('')}</tbody></table>`
}

// ---------------------------------------------------------------------------
// Block detection helpers
// ---------------------------------------------------------------------------

const isHeading = (line: string) => /^#{1,6}\s/.test(line)
const isHr = (line: string) => /^(?:-{3,}|\*{3,}|_{3,})$/.test(line.trim())
const isCodeFence = (line: string) => line.startsWith('```')
const isBlockquote = (line: string) => line.startsWith('>')
const isUnorderedItem = (line: string) => /^[ \t]*[-*+]\s/.test(line)
const isOrderedItem = (line: string) => /^[ \t]*\d+\.\s/.test(line)
const isTableRow = (line: string) => line.trim().startsWith('|') && line.trim().endsWith('|')
const isSeparatorRow = (line: string) => /^\|?[-:| ]+\|?$/.test(line.trim())

function isBlockStart(line: string): boolean {
  return (
    isHeading(line) ||
    isHr(line) ||
    isCodeFence(line) ||
    isBlockquote(line) ||
    isUnorderedItem(line) ||
    isOrderedItem(line) ||
    isTableRow(line) ||
    line.trim() === ''
  )
}

// ---------------------------------------------------------------------------
// Main converter
// ---------------------------------------------------------------------------

export function markdownToHtml(content: string): string {
  if (!content) return ''

  // Already HTML — return unchanged
  if (content.trimStart().startsWith('<')) return content

  const lines = content.split('\n')
  const blocks: string[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]!

    // Skip blank lines
    if (line.trim() === '') {
      i++
      continue
    }

    // Fenced code block
    if (isCodeFence(line)) {
      const lang = line.slice(3).trim()
      const codeLines: string[] = []
      i++
      while (i < lines.length && !isCodeFence(lines[i]!)) {
        codeLines.push(lines[i]!)
        i++
      }
      i++ // skip closing fence
      const langAttr = lang ? ` class="language-${lang}"` : ''
      blocks.push(`<pre><code${langAttr}>${escapeHtml(codeLines.join('\n'))}</code></pre>`)
      continue
    }

    // Heading
    if (isHeading(line)) {
      const m = line.match(/^(#{1,6})\s+(.+)$/)!
      const level = m[1]!.length
      blocks.push(`<h${level}>${inline(m[2]!.trim())}</h${level}>`)
      i++
      continue
    }

    // Horizontal rule
    if (isHr(line)) {
      blocks.push('<hr>')
      i++
      continue
    }

    // Blockquote — collect consecutive > lines
    if (isBlockquote(line)) {
      const bqLines: string[] = []
      while (i < lines.length && (lines[i]!.startsWith('>') || lines[i]!.trim() === '')) {
        if (lines[i]!.trim() === '') {
          bqLines.push('')
        } else {
          bqLines.push(lines[i]!.replace(/^>\s?/, ''))
        }
        i++
      }
      // Strip trailing empty lines
      while (bqLines.length > 0 && bqLines[bqLines.length - 1]!.trim() === '') bqLines.pop()
      const inner = markdownToHtml(bqLines.join('\n'))
      blocks.push(`<blockquote>${inner}</blockquote>`)
      continue
    }

    // GFM Table — header | separator | rows
    if (isTableRow(line) && i + 1 < lines.length && isSeparatorRow(lines[i + 1]!)) {
      const headerLine = line
      i += 2 // skip header + separator
      const bodyLines: string[] = []
      while (i < lines.length && isTableRow(lines[i]!)) {
        bodyLines.push(lines[i]!)
        i++
      }
      blocks.push(parseTable(headerLine, bodyLines))
      continue
    }

    // Unordered list
    if (isUnorderedItem(line)) {
      const items: string[] = []
      while (i < lines.length && isUnorderedItem(lines[i]!)) {
        items.push(lines[i]!.replace(/^[ \t]*[-*+]\s/, ''))
        i++
        // Continuation lines (indented, non-empty, non-item) append to last item
        while (
          i < lines.length &&
          lines[i]!.trim() !== '' &&
          !isUnorderedItem(lines[i]!) &&
          !isOrderedItem(lines[i]!) &&
          !isBlockStart(lines[i]!)
        ) {
          items[items.length - 1] += ' ' + lines[i]!.trim()
          i++
        }
      }
      const lis = items.map((item) => `<li><p>${inline(item)}</p></li>`).join('')
      blocks.push(`<ul>${lis}</ul>`)
      continue
    }

    // Ordered list
    if (isOrderedItem(line)) {
      const items: string[] = []
      while (i < lines.length && isOrderedItem(lines[i]!)) {
        items.push(lines[i]!.replace(/^[ \t]*\d+\.\s/, ''))
        i++
        while (
          i < lines.length &&
          lines[i]!.trim() !== '' &&
          !isUnorderedItem(lines[i]!) &&
          !isOrderedItem(lines[i]!) &&
          !isBlockStart(lines[i]!)
        ) {
          items[items.length - 1] += ' ' + lines[i]!.trim()
          i++
        }
      }
      const lis = items.map((item) => `<li><p>${inline(item)}</p></li>`).join('')
      blocks.push(`<ol>${lis}</ol>`)
      continue
    }

    // Paragraph — collect consecutive non-block lines
    const paraLines: string[] = []
    while (i < lines.length && lines[i]!.trim() !== '' && !isBlockStart(lines[i]!)) {
      paraLines.push(lines[i]!)
      i++
    }
    if (paraLines.length > 0) {
      blocks.push(`<p>${inline(paraLines.join(' '))}</p>`)
    }
  }

  let output = blocks.join('')

  // Consecutive same-type lists created by blank lines between items (common in
  // "formatted" Markdown) produce separate <ul>/<ol> elements. Merge them so
  // they render as one list instead of creating large gaps between items.
  output = output.replace(/<\/ul><ul>/g, '')
  output = output.replace(/<\/ol><ol>/g, '')

  return output
}
