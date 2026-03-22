import { describe, it, expect } from 'vitest'
import { normalizeAssetUrl, looksLikeFaviconAsset } from '../workspace-utils'

// ---------------------------------------------------------------------------
// normalizeAssetUrl
// ---------------------------------------------------------------------------
describe('normalizeAssetUrl', () => {
  it('trims leading and trailing whitespace', () => {
    expect(normalizeAssetUrl('  https://cdn.example.com/logo.png  ')).toBe(
      'https://cdn.example.com/logo.png'
    )
  })

  it('strips a single trailing slash', () => {
    expect(normalizeAssetUrl('https://cdn.example.com/logo.png/')).toBe(
      'https://cdn.example.com/logo.png'
    )
  })

  it('strips multiple trailing slashes', () => {
    expect(normalizeAssetUrl('https://cdn.example.com/logo.png///')).toBe(
      'https://cdn.example.com/logo.png'
    )
  })

  it('handles combined whitespace and trailing slashes', () => {
    expect(normalizeAssetUrl('  https://cdn.example.com/logo.png///  ')).toBe(
      'https://cdn.example.com/logo.png'
    )
  })

  it('returns empty string for whitespace-only input', () => {
    expect(normalizeAssetUrl('   ')).toBe('')
  })

  it('returns empty string for empty input', () => {
    expect(normalizeAssetUrl('')).toBe('')
  })

  it('preserves internal slashes in the URL', () => {
    expect(normalizeAssetUrl('https://cdn.example.com/assets/img/logo.png')).toBe(
      'https://cdn.example.com/assets/img/logo.png'
    )
  })

  it('preserves query strings and fragments', () => {
    expect(normalizeAssetUrl('https://cdn.example.com/logo.png?v=2#section')).toBe(
      'https://cdn.example.com/logo.png?v=2#section'
    )
  })

  it('handles bare domain without path', () => {
    expect(normalizeAssetUrl('https://cdn.example.com/')).toBe(
      'https://cdn.example.com'
    )
  })
})

// ---------------------------------------------------------------------------
// looksLikeFaviconAsset
// ---------------------------------------------------------------------------
describe('looksLikeFaviconAsset', () => {
  describe('positive matches', () => {
    it('detects .ico extension', () => {
      expect(looksLikeFaviconAsset('https://example.com/icon.ico')).toBe(true)
    })

    it('detects .ico in the middle of the path', () => {
      expect(looksLikeFaviconAsset('https://example.com/assets/brand.ico?v=3')).toBe(true)
    })

    it('detects "favicon" anywhere in the string', () => {
      expect(looksLikeFaviconAsset('https://example.com/favicon.png')).toBe(true)
    })

    it('detects "favicon" in a nested path', () => {
      expect(looksLikeFaviconAsset('https://cdn.example.com/assets/favicon-32x32.png')).toBe(true)
    })

    it('detects "apple-touch-icon"', () => {
      expect(looksLikeFaviconAsset('https://example.com/apple-touch-icon.png')).toBe(true)
    })

    it('detects "apple-touch-icon" with size suffix', () => {
      expect(looksLikeFaviconAsset('https://example.com/apple-touch-icon-180x180.png')).toBe(true)
    })

    it('detects "mask-icon"', () => {
      expect(looksLikeFaviconAsset('https://example.com/mask-icon.svg')).toBe(true)
    })

    it('is case-insensitive', () => {
      expect(looksLikeFaviconAsset('https://example.com/Favicon.PNG')).toBe(true)
      expect(looksLikeFaviconAsset('https://example.com/APPLE-TOUCH-ICON.png')).toBe(true)
      expect(looksLikeFaviconAsset('https://example.com/icon.ICO')).toBe(true)
    })
  })

  describe('negative matches', () => {
    it('returns false for a normal logo URL', () => {
      expect(looksLikeFaviconAsset('https://cdn.example.com/logo.png')).toBe(false)
    })

    it('returns false for an SVG logo', () => {
      expect(looksLikeFaviconAsset('https://cdn.example.com/brand-logo.svg')).toBe(false)
    })

    it('returns false for a JPEG image', () => {
      expect(looksLikeFaviconAsset('https://cdn.example.com/hero.jpg')).toBe(false)
    })

    it('returns false for an empty string', () => {
      expect(looksLikeFaviconAsset('')).toBe(false)
    })

    it('returns false for a URL with "icon" but not "favicon" or "mask-icon"', () => {
      expect(looksLikeFaviconAsset('https://cdn.example.com/icon-large.png')).toBe(false)
    })
  })
})
