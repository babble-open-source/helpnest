import { describe, it, expect } from 'vitest'
import { discoverLinks } from '../link-discoverer'

describe('discoverLinks', () => {
  const baseUrl = 'https://acme.com'

  it('extracts same-domain links from HTML', () => {
    const html = `<html><body>
      <a href="https://acme.com/features">Features</a>
      <a href="https://acme.com/pricing">Pricing</a>
      <a href="https://other.com/external">External</a>
    </body></html>`
    const result = discoverLinks(html, baseUrl)
    expect(result).toHaveLength(2)
    expect(result.map((l) => l.url)).toContain('https://acme.com/features')
    expect(result.map((l) => l.url)).toContain('https://acme.com/pricing')
  })

  it('resolves relative URLs to absolute', () => {
    const html = `<html><body>
      <a href="/docs/getting-started">Getting Started</a>
      <a href="about">About</a>
    </body></html>`
    const result = discoverLinks(html, baseUrl)
    expect(result.map((l) => l.url)).toContain('https://acme.com/docs/getting-started')
  })

  it('extracts anchor text', () => {
    const html = `<html><body>
      <a href="/features">Our Amazing Features</a>
    </body></html>`
    const result = discoverLinks(html, baseUrl)
    expect(result[0].anchorText).toBe('Our Amazing Features')
  })

  it('deduplicates URLs (normalizes trailing slashes)', () => {
    const html = `<html><body>
      <a href="/features">Features</a>
      <a href="/features/">Features Page</a>
      <a href="/features?ref=nav">Features Again</a>
    </body></html>`
    const result = discoverLinks(html, baseUrl)
    const featureLinks = result.filter((l) => l.url.startsWith('https://acme.com/features'))
    expect(featureLinks).toHaveLength(1)
  })

  it('strips fragment-only links', () => {
    const html = `<html><body>
      <a href="#section">Jump to section</a>
      <a href="/page#section">Page with section</a>
    </body></html>`
    const result = discoverLinks(html, baseUrl)
    expect(result).toHaveLength(1)
    expect(result[0].url).toBe('https://acme.com/page')
  })

  it('filters out file extensions', () => {
    const html = `<html><body>
      <a href="/doc.pdf">PDF</a>
      <a href="/logo.png">Logo</a>
      <a href="/styles.css">CSS</a>
      <a href="/bundle.js">JS</a>
      <a href="/archive.zip">ZIP</a>
      <a href="/features">Features</a>
    </body></html>`
    const result = discoverLinks(html, baseUrl)
    expect(result).toHaveLength(1)
    expect(result[0].url).toContain('/features')
  })

  it('filters out mailto and tel links', () => {
    const html = `<html><body>
      <a href="mailto:hi@acme.com">Email us</a>
      <a href="tel:+1234567890">Call us</a>
      <a href="/contact">Contact</a>
    </body></html>`
    const result = discoverLinks(html, baseUrl)
    expect(result).toHaveLength(1)
  })

  it('caps at maxLinks', () => {
    const links = Array.from({ length: 300 }, (_, i) => `<a href="/page-${i}">Page ${i}</a>`)
    const html = `<html><body>${links.join('\n')}</body></html>`
    const result = discoverLinks(html, baseUrl, 200)
    expect(result).toHaveLength(200)
  })

  it('excludes the starting URL itself', () => {
    const html = `<html><body>
      <a href="https://acme.com">Home</a>
      <a href="https://acme.com/">Home Again</a>
      <a href="/features">Features</a>
    </body></html>`
    const result = discoverLinks(html, baseUrl)
    expect(result).toHaveLength(1)
    expect(result[0].url).toContain('/features')
  })
})
