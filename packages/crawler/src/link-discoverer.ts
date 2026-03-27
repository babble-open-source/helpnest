import * as cheerio from 'cheerio'
import type { DiscoveredLink } from './types'

const SKIP_EXTENSIONS = [
  '.pdf', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.css', '.js', '.zip',
  '.tar', '.gz', '.mp4', '.mp3', '.woff', '.woff2', '.ttf', '.eot', '.ico',
]

export function discoverLinks(html: string, baseUrl: string, maxLinks: number = 200): DiscoveredLink[] {
  const $ = cheerio.load(html)
  const base = new URL(baseUrl)
  const seen = new Set<string>()
  const results: DiscoveredLink[] = []

  const normalizedBase = normalizeUrl(base.href)
  seen.add(normalizedBase)

  $('a[href]').each((_i, el) => {
    if (results.length >= maxLinks) return false
    const rawHref = $(el).attr('href')
    if (!rawHref) return
    if (/^(mailto:|tel:|javascript:)/i.test(rawHref)) return
    if (rawHref.startsWith('#')) return

    let absolute: URL
    try {
      absolute = new URL(rawHref, baseUrl)
    } catch {
      return
    }
    if (absolute.hostname !== base.hostname) return
    absolute.hash = ''

    const pathname = absolute.pathname.toLowerCase()
    if (SKIP_EXTENSIONS.some((ext) => pathname.endsWith(ext))) return

    const normalized = normalizeUrl(absolute.href)
    if (seen.has(normalized)) return
    seen.add(normalized)

    const anchorText = $(el).text().trim()
    results.push({
      url: absolute.href,
      anchorText: anchorText || pathname,
      context: $(el).parent().text().trim().slice(0, 200),
    })
  })

  return results
}

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url)
    parsed.hash = ''
    parsed.search = ''
    let path = parsed.pathname
    if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1)
    return `${parsed.origin}${path}`
  } catch {
    return url
  }
}
