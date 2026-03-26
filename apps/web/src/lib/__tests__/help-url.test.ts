import { describe, it, expect } from 'vitest'
import { buildHelpPath } from '../help-url'

// ---------------------------------------------------------------------------
// Custom domain / subdomain routing (externalBaseUrl is set)
// The function must return a clean path without the /{workspace}/help prefix.
// ---------------------------------------------------------------------------

describe('buildHelpPath — with externalBaseUrl (custom domain routing)', () => {
  const BASE = 'https://help.example.com'
  const SLUG = 'acme'

  it('returns subPath as-is when it already starts with /', () => {
    expect(buildHelpPath(SLUG, '/getting-started', BASE)).toBe('/getting-started')
  })

  it('prepends / when subPath has no leading slash', () => {
    expect(buildHelpPath(SLUG, 'getting-started', BASE)).toBe('/getting-started')
  })

  it('returns / for a root subPath', () => {
    expect(buildHelpPath(SLUG, '/', BASE)).toBe('/')
  })

  it('returns a nested path unchanged', () => {
    expect(buildHelpPath(SLUG, '/collection/article-slug', BASE)).toBe('/collection/article-slug')
  })

  it('does not include the workspace slug in the output path', () => {
    const result = buildHelpPath(SLUG, '/some-article', BASE)
    expect(result).not.toContain(SLUG)
  })

  it('does not include /help in the output path', () => {
    const result = buildHelpPath(SLUG, '/some-article', BASE)
    expect(result).not.toContain('/help')
  })

  it('works regardless of what the externalBaseUrl value is (it is not used in path construction)', () => {
    // Any truthy externalBaseUrl triggers the clean-path branch
    expect(buildHelpPath(SLUG, '/page', 'https://support.other.io')).toBe('/page')
  })
})

// ---------------------------------------------------------------------------
// Path-based routing (externalBaseUrl is null)
// The function must return /{workspaceSlug}/help{subPath}.
// ---------------------------------------------------------------------------

describe('buildHelpPath — without externalBaseUrl (path-based routing)', () => {
  const SLUG = 'acme'

  it('builds the full path when subPath has a leading slash', () => {
    expect(buildHelpPath(SLUG, '/getting-started', null)).toBe('/acme/help/getting-started')
  })

  it('normalises subPath by prepending / when it is absent', () => {
    expect(buildHelpPath(SLUG, 'getting-started', null)).toBe('/acme/help/getting-started')
  })

  it('omits the trailing subPath segment for the root path /', () => {
    // When subPath is '/', the help home is just /{slug}/help — no trailing slash
    expect(buildHelpPath(SLUG, '/', null)).toBe('/acme/help')
  })

  it('builds a nested path correctly', () => {
    expect(buildHelpPath(SLUG, '/collection/article', null)).toBe('/acme/help/collection/article')
  })

  it('uses the workspaceSlug verbatim (no lowercasing or slugification)', () => {
    expect(buildHelpPath('MyOrg', '/page', null)).toBe('/MyOrg/help/page')
  })

  it('handles a workspace slug with hyphens', () => {
    expect(buildHelpPath('my-company', '/faq', null)).toBe('/my-company/help/faq')
  })
})
