import * as cheerio from 'cheerio'
import TurndownService from 'turndown'

interface ExtractedContent {
  title: string
  markdown: string
}

const STRIP_SELECTORS = 'script, style, nav, footer, header, iframe, noscript, svg'

export function extractContent(
  html: string,
  url: string,
  maxLength: number = 50000,
): ExtractedContent {
  const $ = cheerio.load(html)

  // Extract title BEFORE stripping elements (h1 may be inside header)
  const title = extractTitle($, url)

  // Strip unwanted elements
  $(STRIP_SELECTORS).remove()

  // Try to extract content from <main> or <article> tags
  const mainEl = $('main')
  const articleEl = $('article')
  let contentHtml: string

  if (mainEl.length > 0) {
    contentHtml = mainEl.html() ?? ''
  } else if (articleEl.length > 0) {
    contentHtml = articleEl.html() ?? ''
  } else {
    contentHtml = $('body').html() ?? $.html()
  }

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

function extractTitle($: cheerio.CheerioAPI, url: string): string {
  // Try h1 first (from full document, before stripping)
  const h1 = $('h1').first().text().trim()
  if (h1) return h1

  // Try <title> tag
  const titleTag = $('title').first().text().trim()
  if (titleTag) return titleTag

  // Fallback: last segment of URL path
  try {
    const pathname = new URL(url).pathname
    const segments = pathname.split('/').filter(Boolean)
    return segments[segments.length - 1] ?? 'Untitled'
  } catch {
    return 'Untitled'
  }
}
