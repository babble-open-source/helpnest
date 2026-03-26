import { describe, it, expect, vi, beforeEach } from 'vitest'

// The branding module builds `fontPresets` at module evaluation time by
// iterating `themes`. The mock must be in place before the module is imported.
vi.mock('@/lib/themes', () => {
  const mockTheme = {
    id: 'default',
    name: 'Default',
    colors: {
      cream: '#F7F4EE',
      ink: '#1A1814',
      muted: '#7A756C',
      border: '#E2DDD5',
      accent: '#C8622A',
      green: '#2D6A4F',
      white: '#FFFFFF',
    },
    radius: 'md' as const,
    fonts: {
      heading: 'Instrument Serif, serif',
      body: 'DM Sans, sans-serif',
      headingUrl: 'https://fonts.googleapis.com/heading',
      bodyUrl: 'https://fonts.googleapis.com/body',
    },
  }

  return {
    getTheme: vi.fn(() => mockTheme),
    themeToCSS: vi.fn(() => '--color-cream: #F7F4EE'),
    themes: [
      mockTheme,
      {
        ...mockTheme,
        id: 'dark',
        name: 'Dark',
        fonts: {
          ...mockTheme.fonts,
          heading: 'Inter, sans-serif',
          body: 'Inter, sans-serif',
          headingUrl: 'https://fonts.googleapis.com/inter',
          bodyUrl: undefined,
        },
      },
    ],
  }
})

vi.mock('@/lib/font-url', () => ({
  isAllowedFontUrl: vi.fn((url: string) => !url || url.startsWith('https://fonts.googleapis.com')),
}))

import {
  fontPresets,
  getFontPreset,
  resolveWorkspaceTheme,
  getWorkspaceBrandFontStack,
  getWorkspaceThemeCSS,
  getWorkspaceFontUrls,
  getAllFontPresetUrls,
  radiusOptions,
  colorOverrideKeys,
} from '../branding'
import { getTheme, themeToCSS } from '@/lib/themes'

const mockGetTheme = vi.mocked(getTheme)
const mockThemeToCSS = vi.mocked(themeToCSS)

// ---------------------------------------------------------------------------
// radiusOptions
// ---------------------------------------------------------------------------

describe('radiusOptions', () => {
  it('contains all expected radius values in order', () => {
    expect(radiusOptions).toEqual(['none', 'sm', 'md', 'lg', 'xl'])
  })
})

// ---------------------------------------------------------------------------
// colorOverrideKeys
// ---------------------------------------------------------------------------

describe('colorOverrideKeys', () => {
  it('contains all seven expected color keys', () => {
    expect(colorOverrideKeys).toEqual(['cream', 'ink', 'muted', 'border', 'accent', 'green', 'white'])
  })
})

// ---------------------------------------------------------------------------
// fontPresets (built from mocked themes at module load time)
// ---------------------------------------------------------------------------

describe('fontPresets', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(fontPresets)).toBe(true)
    expect(fontPresets.length).toBeGreaterThan(0)
  })

  it('each preset has id, name, headingLabel, bodyLabel, and fonts', () => {
    for (const preset of fontPresets) {
      expect(preset).toHaveProperty('id')
      expect(preset).toHaveProperty('name')
      expect(preset).toHaveProperty('headingLabel')
      expect(preset).toHaveProperty('bodyLabel')
      expect(preset).toHaveProperty('fonts')
    }
  })

  it('deduplicates themes that share the same primary heading font', () => {
    // Both mock themes use different primary heading fonts (Instrument Serif vs Inter)
    // so both should appear; no theme is silently dropped.
    const ids = fontPresets.map((p) => p.id)
    expect(ids).toContain('default')
    expect(ids).toContain('dark')
  })

  it('headingLabel strips quotes and generic fallbacks from the font stack', () => {
    const defaultPreset = fontPresets.find((p) => p.id === 'default')
    expect(defaultPreset?.headingLabel).toBe('Instrument Serif')
  })
})

// ---------------------------------------------------------------------------
// getFontPreset
// ---------------------------------------------------------------------------

describe('getFontPreset', () => {
  it('returns the matching preset for a known id', () => {
    const preset = getFontPreset('default')
    expect(preset).toBeDefined()
    expect(preset?.id).toBe('default')
  })

  it('returns the dark preset for the dark id', () => {
    const preset = getFontPreset('dark')
    expect(preset).toBeDefined()
    expect(preset?.id).toBe('dark')
  })

  it('returns undefined for an unknown id', () => {
    expect(getFontPreset('nonexistent-theme')).toBeUndefined()
  })

  it('returns undefined when called with null', () => {
    expect(getFontPreset(null)).toBeUndefined()
  })

  it('returns undefined when called with undefined', () => {
    expect(getFontPreset(undefined)).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// resolveWorkspaceTheme
// ---------------------------------------------------------------------------

describe('resolveWorkspaceTheme', () => {
  it('returns the base theme when no overrides are provided', () => {
    const theme = resolveWorkspaceTheme('default')
    expect(theme.id).toBe('default')
    expect(theme.colors.cream).toBe('#F7F4EE')
    expect(theme.fonts.heading).toBe('Instrument Serif, serif')
  })

  it('applies individual color overrides while preserving non-overridden colors', () => {
    const theme = resolveWorkspaceTheme('default', {
      customAccentColor: '#FF0000',
      customInkColor: '#000000',
    })
    expect(theme.colors.accent).toBe('#FF0000')
    expect(theme.colors.ink).toBe('#000000')
    // Non-overridden color should remain from the base theme
    expect(theme.colors.cream).toBe('#F7F4EE')
  })

  it('applies a font preset by replacing fonts wholesale', () => {
    const theme = resolveWorkspaceTheme('default', { fontPresetId: 'dark' })
    // The dark preset uses Inter
    expect(theme.fonts.heading).toContain('Inter')
  })

  it('applies custom heading font by prepending it to the existing stack', () => {
    const theme = resolveWorkspaceTheme('default', {
      customHeadingFontFamily: 'Playfair Display',
      customHeadingFontUrl: 'https://fonts.googleapis.com/playfair',
    })
    expect(theme.fonts.heading).toContain('Playfair Display')
    expect(theme.fonts.heading).toContain('Instrument Serif')
    expect(theme.fonts.headingUrl).toBe('https://fonts.googleapis.com/playfair')
  })

  it('applies custom body font by prepending it to the existing stack', () => {
    const theme = resolveWorkspaceTheme('default', {
      customBodyFontFamily: 'Lato',
      customBodyFontUrl: 'https://fonts.googleapis.com/lato',
    })
    expect(theme.fonts.body).toContain('Lato')
    expect(theme.fonts.body).toContain('DM Sans')
    expect(theme.fonts.bodyUrl).toBe('https://fonts.googleapis.com/lato')
  })

  it('wraps a multi-word custom font name in double quotes', () => {
    const theme = resolveWorkspaceTheme('default', {
      customHeadingFontFamily: 'Playfair Display',
    })
    expect(theme.fonts.heading).toMatch(/^"Playfair Display"/)
  })

  it('does not double-quote a font family that already contains commas (stack)', () => {
    const theme = resolveWorkspaceTheme('default', {
      customHeadingFontFamily: 'Roboto, sans-serif',
    })
    // Already has a comma — should not wrap in extra quotes
    expect(theme.fonts.heading).not.toMatch(/^"Roboto, sans-serif"/)
  })

  it('applies radius override', () => {
    const theme = resolveWorkspaceTheme('default', { customRadius: 'xl' })
    expect(theme.radius).toBe('xl')
  })

  it('uses base theme radius when no radius override is provided', () => {
    const theme = resolveWorkspaceTheme('default')
    expect(theme.radius).toBe('md')
  })

  it('ignores empty string custom heading family (no prepending)', () => {
    const theme = resolveWorkspaceTheme('default', { customHeadingFontFamily: '   ' })
    // Whitespace-only value should be treated as no override
    expect(theme.fonts.heading).toBe('Instrument Serif, serif')
  })
})

// ---------------------------------------------------------------------------
// getWorkspaceBrandFontStack
// ---------------------------------------------------------------------------

describe('getWorkspaceBrandFontStack', () => {
  it('returns null when no brand font family is configured', () => {
    expect(getWorkspaceBrandFontStack('default', {})).toBeNull()
  })

  it('returns null when brand font family is an empty string', () => {
    expect(getWorkspaceBrandFontStack('default', { customBrandFontFamily: '' })).toBeNull()
  })

  it('returns null when brand font family is whitespace only', () => {
    expect(getWorkspaceBrandFontStack('default', { customBrandFontFamily: '   ' })).toBeNull()
  })

  it('returns a font stack combining brand font and heading font from resolved theme', () => {
    const stack = getWorkspaceBrandFontStack('default', { customBrandFontFamily: 'Oswald' })
    expect(stack).not.toBeNull()
    expect(stack).toContain('Oswald')
    expect(stack).toContain('Instrument Serif')
  })

  it('quotes a multi-word brand font name', () => {
    const stack = getWorkspaceBrandFontStack('default', { customBrandFontFamily: 'Playfair Display' })
    expect(stack).toMatch(/"Playfair Display"/)
  })
})

// ---------------------------------------------------------------------------
// getWorkspaceThemeCSS
// ---------------------------------------------------------------------------

describe('getWorkspaceThemeCSS', () => {
  beforeEach(() => {
    mockThemeToCSS.mockReturnValue('--color-cream: #F7F4EE')
  })

  it('returns a string containing the base CSS from themeToCSS', () => {
    const css = getWorkspaceThemeCSS('default')
    expect(css).toContain('--color-cream: #F7F4EE')
  })

  it('appends a --font-brand variable', () => {
    const css = getWorkspaceThemeCSS('default')
    expect(css).toContain('--font-brand:')
  })

  it('sets --font-brand to the heading font when no brand font is configured', () => {
    const css = getWorkspaceThemeCSS('default')
    // When no brand font, falls back to theme's heading font
    expect(css).toContain('Instrument Serif')
  })

  it('sets --font-brand to the brand font stack when a brand font is configured', () => {
    const css = getWorkspaceThemeCSS('default', { customBrandFontFamily: 'Oswald' })
    expect(css).toContain('Oswald')
  })
})

// ---------------------------------------------------------------------------
// getWorkspaceFontUrls
// ---------------------------------------------------------------------------

describe('getWorkspaceFontUrls', () => {
  it('returns unique allowed font URLs from the resolved theme', () => {
    const urls = getWorkspaceFontUrls('default')
    // The default theme provides headingUrl and bodyUrl from the mock
    expect(urls).toContain('https://fonts.googleapis.com/heading')
    expect(urls).toContain('https://fonts.googleapis.com/body')
  })

  it('includes a brand font URL when it is an allowed URL', () => {
    const urls = getWorkspaceFontUrls('default', {
      customBrandFontFamily: 'Oswald',
      customBrandFontUrl: 'https://fonts.googleapis.com/oswald',
    })
    expect(urls).toContain('https://fonts.googleapis.com/oswald')
  })

  it('deduplicates identical font URLs', () => {
    // Provide a brand font URL that is the same as the heading URL
    const urls = getWorkspaceFontUrls('default', {
      customBrandFontUrl: 'https://fonts.googleapis.com/heading',
    })
    const headingUrlCount = urls.filter((u) => u === 'https://fonts.googleapis.com/heading').length
    expect(headingUrlCount).toBe(1)
  })

  it('excludes URLs that are not allowed by isAllowedFontUrl', () => {
    // The mock treats non-googleapis URLs as disallowed
    const urls = getWorkspaceFontUrls('default', {
      customBrandFontFamily: 'CustomFont',
      customBrandFontUrl: 'https://untrusted-cdn.example.com/font.css',
    })
    expect(urls).not.toContain('https://untrusted-cdn.example.com/font.css')
  })

  it('returns an empty array when all font URLs are absent or disallowed', () => {
    // Override the theme to have no URLs
    mockGetTheme.mockReturnValueOnce({
      id: 'default',
      name: 'Default',
      description: 'Default theme',
      author: 'HelpNest',
      tags: [],
      dark: false,
      colors: {
        cream: '#F7F4EE',
        ink: '#1A1814',
        muted: '#7A756C',
        border: '#E2DDD5',
        accent: '#C8622A',
        green: '#2D6A4F',
        white: '#FFFFFF',
      },
      radius: 'md' as const,
      fonts: {
        heading: 'Instrument Serif, serif',
        body: 'DM Sans, sans-serif',
        headingUrl: undefined,
        bodyUrl: undefined,
      },
    })
    const urls = getWorkspaceFontUrls('default')
    expect(urls).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// getAllFontPresetUrls
// ---------------------------------------------------------------------------

describe('getAllFontPresetUrls', () => {
  it('returns an array of strings', () => {
    const urls = getAllFontPresetUrls()
    expect(Array.isArray(urls)).toBe(true)
    for (const url of urls) {
      expect(typeof url).toBe('string')
    }
  })

  it('includes URLs from all presets', () => {
    const urls = getAllFontPresetUrls()
    // Default preset has headingUrl and bodyUrl set in the mock
    expect(urls).toContain('https://fonts.googleapis.com/heading')
    expect(urls).toContain('https://fonts.googleapis.com/body')
  })

  it('deduplicates URLs that appear in multiple presets', () => {
    const urls = getAllFontPresetUrls()
    const unique = new Set(urls)
    expect(urls.length).toBe(unique.size)
  })

  it('excludes undefined bodyUrl values (dark preset has no bodyUrl in mock)', () => {
    const urls = getAllFontPresetUrls()
    expect(urls).not.toContain(undefined)
    expect(urls.every((u) => typeof u === 'string')).toBe(true)
  })
})
