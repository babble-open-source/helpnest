export function renderMarkdown(md: string): string {
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

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="hn-md-a">$1</a>'
  )

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
