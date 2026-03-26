import TurndownService from 'turndown'

interface ExtractedContent {
  title: string
  markdown: string
}

const STRIP_TAGS = ['script', 'style', 'nav', 'footer', 'header', 'iframe', 'noscript', 'svg']

export function extractContent(
  html: string,
  url: string,
  maxLength: number = 50000,
): ExtractedContent {
  let cleaned = html

  // Strip unwanted tags and their contents
  for (const tag of STRIP_TAGS) {
    const regex = new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi')
    cleaned = cleaned.replace(regex, '')
    // Also strip self-closing variants
    const selfClosing = new RegExp(`<${tag}[^>]*\\/?>`, 'gi')
    cleaned = cleaned.replace(selfClosing, '')
  }

  // Try to extract content from <main> or <article> tags
  const mainMatch = cleaned.match(/<main[^>]*>([\s\S]*?)<\/main>/i)
  const articleMatch = cleaned.match(/<article[^>]*>([\s\S]*?)<\/article>/i)
  const contentHtml = mainMatch?.[1] ?? articleMatch?.[1] ?? extractBody(cleaned)

  // Extract title: first <h1>, then <title>, then URL path
  const title = extractTitle(cleaned, url)

  // Convert HTML to Markdown
  const turndown = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
  })

  let markdown = turndown.turndown(contentHtml)

  // Truncate if needed
  if (markdown.length > maxLength) {
    markdown = markdown.slice(0, maxLength)
  }

  return { title, markdown }
}

function extractBody(html: string): string {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  return bodyMatch?.[1] ?? html
}

function extractTitle(html: string, url: string): string {
  // Try h1 first
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
  if (h1Match) {
    return stripTags(h1Match[1]).trim()
  }

  // Try <title> tag
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  if (titleMatch) {
    return stripTags(titleMatch[1]).trim()
  }

  // Fallback: last segment of URL path
  try {
    const pathname = new URL(url).pathname
    const segments = pathname.split('/').filter(Boolean)
    return segments[segments.length - 1] ?? 'Untitled'
  } catch {
    return 'Untitled'
  }
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, '')
}
