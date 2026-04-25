export function renderMarkdown(md: string, baseUrl?: string): string {
  // Normalize inline bullet lists: AI often generates "... sentence. - **Item**: ..."
  // all on one line. Split them onto separate lines so the list regex can match.
  md = md.replace(/([.!?:,])\s+- (?=\S)/g, '$1\n- ')

  let html = escapeHtml(md)

  // Code blocks (``` ... ```)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, _lang, code) =>
    `<pre class="hn-md-code-block"><code>${code.trim()}</code></pre>`
  )

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="hn-md-code">$1</code>')

  // Images
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g,
    '<img class="hn-md-img" src="$2" alt="$1" loading="lazy" />'
  )

  // Links — resolve against baseUrl so both absolute and any relative format work
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, text, href) => {
    try {
      const base = baseUrl ?? (typeof window !== 'undefined' ? window.location.origin : '')
      const url = new URL(href, base || undefined)
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return `<span class="hn-md-a">${text}</span>`
      }
      const safeHref = url.href.replace(/"/g, '%22').replace(/'/g, '%27')
      return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer" class="hn-md-a">${text}</a>`
    } catch {
      return `<span class="hn-md-a">${text}</span>`
    }
  })

  // Headings (h1-h4)
  html = html.replace(/^#### (.+)$/gm, '<h4 class="hn-md-h4">$1</h4>')
  html = html.replace(/^### (.+)$/gm, '<h3 class="hn-md-h3">$1</h3>')
  html = html.replace(/^## (.+)$/gm, '<h2 class="hn-md-h2">$1</h2>')
  html = html.replace(/^# (.+)$/gm, '<h1 class="hn-md-h1">$1</h1>')

  // Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')

  // Unordered lists
  html = html.replace(/^[-*] (.+)$/gm, '<li class="hn-md-li">$1</li>')
  html = html.replace(/((?:<li class="hn-md-li">.*<\/li>\n?)+)/g, '<ul class="hn-md-ul">$1</ul>')

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li class="hn-md-oli">$1</li>')
  html = html.replace(/((?:<li class="hn-md-oli">.*<\/li>\n?)+)/g, '<ol class="hn-md-ol">$1</ol>')
  // Merge consecutive <ol> blocks separated only by whitespace (blank lines between items)
  html = html.replace(/<\/ol>\s*<ol class="hn-md-ol">/g, '')

  // GFM tables
  html = html.replace(
    /^(\|.+\|)\n\|[-| :]+\|\n((?:\|.+\|\n?)*)/gm,
    (_m, headerRow, bodyRows) => {
      const parseRow = (row: string) =>
        row.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim())
      const headers = parseRow(headerRow)
        .map((h) => `<th class="hn-md-th">${h}</th>`)
        .join('')
      const rows = bodyRows
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((row: string) =>
          `<tr>${parseRow(row).map((c) => `<td class="hn-md-td">${c}</td>`).join('')}</tr>`
        )
        .join('')
      return `<table class="hn-md-table"><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`
    }
  )

  // Horizontal rule
  html = html.replace(/^---+$/gm, '<hr class="hn-md-hr" />')

  // Paragraphs
  html = html
    .split(/\n{2,}/)
    .map((block) => {
      const trimmed = block.trim()
      if (!trimmed) return ''
      if (trimmed.startsWith('<')) return trimmed
      return `<p class="hn-md-p">${trimmed.replace(/\n/g, '<br />')}</p>`
    })
    .filter(Boolean)
    .join('')

  html = html.replace(/(<br\s*\/?>){2,}/g, '<br />')

  return html
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
