import { describe, it, expect } from 'vitest'
import { isAllowedFontUrl } from '../font-url'

// ---------------------------------------------------------------------------
// Empty / absent values — treated as "no font URL configured" → allowed
// ---------------------------------------------------------------------------

describe('isAllowedFontUrl — empty / absent values', () => {
  it('returns true for null', () => {
    expect(isAllowedFontUrl(null)).toBe(true)
  })

  it('returns true for undefined', () => {
    expect(isAllowedFontUrl(undefined)).toBe(true)
  })

  it('returns true for an empty string', () => {
    expect(isAllowedFontUrl('')).toBe(true)
  })

  it('returns true for a whitespace-only string', () => {
    expect(isAllowedFontUrl('   ')).toBe(true)
  })

  it('returns true for a tab-only string', () => {
    expect(isAllowedFontUrl('\t')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Allowed hosts — HTTPS URLs on the allowlist
// ---------------------------------------------------------------------------

describe('isAllowedFontUrl — valid font CDN URLs', () => {
  it('accepts a Google Fonts stylesheet URL', () => {
    expect(
      isAllowedFontUrl('https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap')
    ).toBe(true)
  })

  it('accepts a Bunny Fonts URL', () => {
    expect(
      isAllowedFontUrl('https://fonts.bunny.net/css?family=inter:400,700')
    ).toBe(true)
  })

  it('accepts a Typekit URL', () => {
    expect(
      isAllowedFontUrl('https://use.typekit.net/abc1234.css')
    ).toBe(true)
  })

  it('accepts a cdnfonts URL', () => {
    expect(
      isAllowedFontUrl('https://fonts.cdnfonts.com/css/inter')
    ).toBe(true)
  })

  it('trims leading and trailing whitespace before validating', () => {
    expect(
      isAllowedFontUrl('  https://fonts.googleapis.com/css2?family=Roboto  ')
    ).toBe(true)
  })

  it('accepts a URL with a long query string and multiple params', () => {
    expect(
      isAllowedFontUrl(
        'https://fonts.googleapis.com/css2?family=Lato:ital,wght@0,400;0,700;1,400&display=swap'
      )
    ).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// HTTP (non-HTTPS) — rejected regardless of host
// ---------------------------------------------------------------------------

describe('isAllowedFontUrl — HTTP URLs', () => {
  it('rejects an HTTP Google Fonts URL', () => {
    expect(
      isAllowedFontUrl('http://fonts.googleapis.com/css2?family=Inter')
    ).toBe(false)
  })

  it('rejects an HTTP Bunny Fonts URL', () => {
    expect(isAllowedFontUrl('http://fonts.bunny.net/css?family=inter')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Unknown / untrusted hosts
// ---------------------------------------------------------------------------

describe('isAllowedFontUrl — unknown hosts', () => {
  it('rejects a URL from an arbitrary HTTPS host', () => {
    expect(isAllowedFontUrl('https://evil.example.com/css/font.css')).toBe(false)
  })

  it('rejects a URL that looks like a Google subdomain but is not the exact host', () => {
    // "fonts.googleapis.com.attacker.com" contains the allowed host as a substring
    // but has a different hostname — must be rejected.
    expect(
      isAllowedFontUrl('https://fonts.googleapis.com.attacker.com/css')
    ).toBe(false)
  })

  it('rejects a self-hosted font URL', () => {
    expect(isAllowedFontUrl('https://cdn.myapp.io/fonts/inter.css')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Malformed / non-URL inputs
// ---------------------------------------------------------------------------

describe('isAllowedFontUrl — malformed URLs', () => {
  it('rejects a plain string that is not a URL', () => {
    expect(isAllowedFontUrl('not-a-url')).toBe(false)
  })

  it('rejects a string with only a hostname and no scheme', () => {
    expect(isAllowedFontUrl('fonts.googleapis.com/css2?family=Inter')).toBe(false)
  })

  it('rejects a javascript: URI', () => {
    // javascript: is not https: and will fail the protocol check
    expect(isAllowedFontUrl('javascript:alert(1)')).toBe(false)
  })

  it('rejects a data: URI', () => {
    expect(isAllowedFontUrl('data:text/css,body{}')).toBe(false)
  })
})
