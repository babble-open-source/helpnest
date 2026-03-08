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
  let html = md
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
    // Unordered list items
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    // Ordered list items
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')

  // Wrap consecutive <li> runs in <ul>
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`)

  // Split on blank lines to form paragraphs
  const blocks = html.split(/\n{2,}/)
  html = blocks
    .map((block) => {
      const trimmed = block.trim()
      if (!trimmed) return ''
      // Already a block element — leave as-is
      if (/^<(h[1-6]|ul|ol|li|blockquote|hr|pre)/.test(trimmed)) return trimmed
      // Single newlines within a block become spaces (inline content)
      return `<p>${trimmed.replace(/\n/g, ' ')}</p>`
    })
    .filter(Boolean)
    .join('\n')

  return html
}
