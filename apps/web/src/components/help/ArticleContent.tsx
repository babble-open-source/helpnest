'use client'

interface Props {
  content: string
}

function renderMarkdown(md: string): string {
  return md
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
    // Unordered lists
    .replace(/^[-*] (.+)$/gm, '<li class="ml-4 list-disc text-ink/90 my-1">$1</li>')
    // Ordered lists
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal text-ink/90 my-1">$1</li>')
    // Wrap consecutive li in ul/ol
    .replace(/(<li.*<\/li>\n?)+/g, (m) => `<ul class="my-4 space-y-1">${m}</ul>`)
    // Horizontal rule
    .replace(/^---$/gm, '<hr class="border-border my-8" />')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-accent hover:underline" target="_blank" rel="noopener">$1</a>')
    // Paragraphs (double newlines)
    .replace(/\n\n(?!<[uo]l|<h[1-6]|<hr|<blockquote)/g, '</p><p class="text-ink/90 leading-7 my-4">')
    // Wrap in paragraph if not already
    .replace(/^(?!<[h1-6uo]|<hr|<blockquote)(.+)/, '<p class="text-ink/90 leading-7 my-4">$1')
    // Close last paragraph
    + '</p>'
    // Clean up empty paragraphs
    .replace(/<p[^>]*><\/p>/g, '')
}

export function ArticleContent({ content }: Props) {
  const html = renderMarkdown(content)
  return (
    <div
      className="prose-custom text-ink/90 leading-7"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
