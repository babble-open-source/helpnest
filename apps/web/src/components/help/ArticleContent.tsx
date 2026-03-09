'use client'

interface Props {
  content: string
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function renderMarkdown(md: string): string {
  // Extract fenced code blocks before any other processing to prevent
  // paragraph logic and inline-code regex from mangling them.
  const codeBlocks: string[] = []
  let out = md.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, _lang, code) => {
    codeBlocks.push(
      `<pre class="bg-ink text-cream rounded-lg p-4 overflow-x-auto my-5"><code class="text-sm font-mono">${escapeHtml(code.trim())}</code></pre>`
    )
    return `\x00CODE${codeBlocks.length - 1}\x00`
  })

  out = out
    // Headers with IDs
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
    // Bold and italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-ink">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="bg-cream border border-border rounded px-1.5 py-0.5 text-sm font-mono text-accent">$1</code>')
    // Blockquote
    .replace(/^> (.+)$/gm, '<blockquote class="border-l-4 border-accent pl-4 text-muted italic my-4">$1</blockquote>')
    // Unordered lists — temp marker
    .replace(/^[-*] (.+)$/gm, '<li-ul class="text-ink/90 my-1">$1</li-ul>')
    // Ordered lists — temp marker
    .replace(/^\d+\. (.+)$/gm, '<li-ol class="text-ink/90 my-1">$1</li-ol>')
    // Wrap in correct container; list-style class lives on the container, not the item
    .replace(/(<li-ul.*<\/li-ul>\n?)+/g, (m) =>
      `<ul class="list-disc pl-5 my-4 space-y-1">${m.replace(/li-ul/g, 'li')}</ul>`)
    .replace(/(<li-ol.*<\/li-ol>\n?)+/g, (m) =>
      `<ol class="list-decimal pl-5 my-4 space-y-1">${m.replace(/li-ol/g, 'li')}</ol>`)
    // Horizontal rule
    .replace(/^---$/gm, '<hr class="border-border my-8" />')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-accent hover:underline" target="_blank" rel="noopener">$1</a>')
    // Paragraphs (double newlines) — skip code block placeholders
    .replace(/\n\n(?!<[uo]l|<h[1-6]|<hr|<blockquote|\x00CODE)/g, '</p><p class="text-ink/90 leading-7 my-4">')
    // Wrap in paragraph if not already a block element or placeholder
    .replace(/^(?!<[h1-6uo]|<hr|<blockquote|\x00CODE)(.+)/, '<p class="text-ink/90 leading-7 my-4">$1')
    // Close last paragraph
    + '</p>'
    // Clean up empty paragraphs
    .replace(/<p[^>]*><\/p>/g, '')

  // Restore code blocks
  codeBlocks.forEach((block, i) => {
    out = out.replace(`\x00CODE${i}\x00`, block)
  })

  return out
}

export function ArticleContent({ content }: Props) {
  // Tiptap saves HTML (starts with `<`); legacy seed data is Markdown.
  const html = content.trimStart().startsWith('<') ? content : renderMarkdown(content)
  return (
    <div
      className="article-prose text-ink/90 leading-7"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
