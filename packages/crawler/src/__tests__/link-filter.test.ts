import { describe, it, expect } from 'vitest'
import { buildLinkFilterPrompt, parseLinkFilterResponse } from '../link-filter'
import type { DiscoveredLink } from '../types'

describe('buildLinkFilterPrompt', () => {
  it('includes the goal in the prompt', () => {
    const links: DiscoveredLink[] = [
      { url: 'https://acme.com/features', anchorText: 'Features', context: '' },
    ]
    const result = buildLinkFilterPrompt(links, 'How billing works', 'acme.com')
    expect(result.system).toContain('billing')
    expect(result.userMessage).toContain('features')
  })

  it('includes all discovered links in user message', () => {
    const links: DiscoveredLink[] = [
      { url: 'https://acme.com/a', anchorText: 'Page A', context: '' },
      { url: 'https://acme.com/b', anchorText: 'Page B', context: '' },
      { url: 'https://acme.com/c', anchorText: 'Page C', context: '' },
    ]
    const result = buildLinkFilterPrompt(links, 'Cover all features', 'acme.com')
    expect(result.userMessage).toContain('Page A')
    expect(result.userMessage).toContain('Page B')
    expect(result.userMessage).toContain('Page C')
  })
})

describe('parseLinkFilterResponse', () => {
  it('parses a well-formed JSON response', () => {
    const raw = JSON.stringify({
      mode: 'focused',
      links: [{ url: 'https://acme.com/billing', reason: 'Billing page', priority: 'high' }],
    })
    const result = parseLinkFilterResponse(raw)
    expect(result.mode).toBe('focused')
    expect(result.selectedLinks).toHaveLength(1)
    expect(result.selectedLinks[0].url).toBe('https://acme.com/billing')
  })

  it('extracts JSON from code block', () => {
    const raw = '```json\n{"mode":"discovery","links":[{"url":"https://a.com/x","reason":"x","priority":"high"}]}\n```'
    const result = parseLinkFilterResponse(raw)
    expect(result.mode).toBe('discovery')
    expect(result.selectedLinks).toHaveLength(1)
  })

  it('defaults to discovery mode when >5 links', () => {
    const links = Array.from({ length: 10 }, (_, i) => ({
      url: `https://a.com/${i}`, reason: `reason ${i}`, priority: 'medium',
    }))
    const raw = JSON.stringify({ mode: 'focused', links })
    const result = parseLinkFilterResponse(raw)
    expect(result.mode).toBe('discovery')
  })

  it('returns empty result for unparseable response', () => {
    const result = parseLinkFilterResponse('not json at all')
    expect(result.selectedLinks).toEqual([])
    expect(result.mode).toBe('focused')
  })
})
