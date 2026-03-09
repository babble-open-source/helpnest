/**
 * Content format utilities.
 *
 * Articles are stored as either:
 *   - Markdown  — legacy seed data, starts with `#` headings or plain text
 *   - HTML      — new articles written/edited in the Tiptap editor (starts with `<`)
 *
 * The Tiptap editor only understands HTML. The public help-center page
 * must handle both until all legacy articles are re-saved through the editor.
 */

/** True when content was written in the Tiptap editor (HTML format). */
export function isHtml(content: string): boolean {
  return content.trimStart().startsWith('<')
}

/**
 * Convert Markdown to clean HTML suitable for Tiptap.
 * Handles: headings, bold/italic, code, blockquote, lists, links, hr, paragraphs.
 * Does NOT inject Tailwind classes — Tiptap strips them anyway.
 */
export function mdToHtml(md: string): string {
  // Extract fenced code blocks first — they may contain blank lines or backticks
  // that would break paragraph splitting and inline-code replacement.
  const codeBlocks: string[] = []
  let html = md.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const safe = code.trim()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
    codeBlocks.push(`<pre><code${lang ? ` class="language-${lang}"` : ''}>${safe}</code></pre>`)
    return `\x00CODE${codeBlocks.length - 1}\x00`
  })

  html = html
    // Headings
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold + italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Inline code
    .replace(/`([^`\n]+)`/g, '<code>$1</code>')
    // Blockquote
    .replace(/^> (.+)$/gm, '<blockquote><p>$1</p></blockquote>')
    // Horizontal rule
    .replace(/^---$/gm, '<hr>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    // Unordered list items — temp marker so we can wrap in <ul>
    .replace(/^[-*] (.+)$/gm, '<li-ul>$1</li-ul>')
    // Ordered list items — temp marker so we can wrap in <ol>
    .replace(/^\d+\. (.+)$/gm, '<li-ol>$1</li-ol>')

  // Wrap consecutive runs in the correct container, then normalise the tag
  html = html
    .replace(/(<li-ul>.*<\/li-ul>\n?)+/g, (m) => `<ul>${m.replace(/li-ul/g, 'li')}</ul>`)
    .replace(/(<li-ol>.*<\/li-ol>\n?)+/g, (m) => `<ol>${m.replace(/li-ol/g, 'li')}</ol>`)

  // Split on blank lines to form paragraphs
  const blocks = html.split(/\n{2,}/)
  html = blocks
    .map((block) => {
      const trimmed = block.trim()
      if (!trimmed) return ''
      // Code block placeholder or block element — leave as-is
      if (trimmed.startsWith('\x00CODE') || /^<(h[1-6]|ul|ol|blockquote|hr|pre)/.test(trimmed)) return trimmed
      // Single newlines within a block become spaces (inline content)
      return `<p>${trimmed.replace(/\n/g, ' ')}</p>`
    })
    .filter(Boolean)
    .join('\n')

  // Restore code blocks
  codeBlocks.forEach((block, i) => {
    html = html.replace(`\x00CODE${i}\x00`, block)
  })

  return html
}
