import { resolveWorkspaceTheme, type WorkspaceFontOverrides } from '@/lib/branding'

export const OG_SIZE = { width: 1200, height: 630 }

export const DEFAULT_COLORS = {
  cream: '#F7F4EE',
  ink: '#1A1814',
  muted: '#7A756C',
  border: '#E2DDD5',
  accent: '#C8622A',
}

/** Resolve the workspace's OG image palette (theme + custom overrides). */
export function resolveOgColors(
  themeId: string,
  overrides: WorkspaceFontOverrides = {},
): typeof DEFAULT_COLORS {
  const theme = resolveWorkspaceTheme(themeId, overrides)
  return {
    cream: theme.colors.cream,
    ink: theme.colors.ink,
    muted: theme.colors.muted,
    border: theme.colors.border,
    accent: theme.colors.accent,
  }
}

// ---------------------------------------------------------------------------
// Font loading
// ---------------------------------------------------------------------------

const INSTRUMENT_SERIF_URL =
  'https://fonts.gstatic.com/s/instrumentserif/v5/jizBRFtNs2ka5fXjeivQ4LroWlx-2zI.ttf'
const DM_SANS_URL =
  'https://fonts.gstatic.com/s/dmsans/v17/rP2tp2ywxg089UriI5-g4vlH9VoD8CmcqZG40F9JadbnoEwAopxhTg.ttf'

/** Default fonts — cached at module level (fetched once per server process). */
let defaultFontsPromise: Promise<{ heading: ArrayBuffer; body: ArrayBuffer }> | null = null

export function loadDefaultFonts() {
  if (!defaultFontsPromise) {
    defaultFontsPromise = Promise.all([
      fetch(INSTRUMENT_SERIF_URL).then((r) => r.arrayBuffer()),
      fetch(DM_SANS_URL).then((r) => r.arrayBuffer()),
    ]).then(([heading, body]) => ({ heading, body }))
  }
  return defaultFontsPromise
}

/**
 * Extract the first .ttf URL from a Google Fonts CSS stylesheet URL.
 * Returns null if the URL is invalid or the CSS doesn't contain a TTF.
 */
async function extractTtfFromCssUrl(cssUrl: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(cssUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
    if (!res.ok) return null
    const css = await res.text()
    const match = css.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.ttf)\)/)
    if (!match?.[1]) return null
    const fontRes = await fetch(match[1])
    return fontRes.ok ? fontRes.arrayBuffer() : null
  } catch {
    return null
  }
}

export interface OgFonts {
  heading: { name: string; data: ArrayBuffer }
  body: { name: string; data: ArrayBuffer }
  brand: { name: string; data: ArrayBuffer } | null
}

/**
 * Load fonts for OG image generation. Uses workspace custom fonts when
 * available, falling back to Instrument Serif (heading) and DM Sans (body).
 */
export async function loadFonts(overrides?: {
  headingFontFamily?: string | null
  headingFontUrl?: string | null
  brandFontFamily?: string | null
  brandFontUrl?: string | null
}): Promise<OgFonts> {
  const defaults = await loadDefaultFonts()

  let headingName = 'Instrument Serif'
  let headingData = defaults.heading

  // Custom heading font
  if (overrides?.headingFontFamily && overrides?.headingFontUrl) {
    const custom = await extractTtfFromCssUrl(overrides.headingFontUrl)
    if (custom) {
      headingName = overrides.headingFontFamily
      headingData = custom
    }
  }

  // Custom brand font (for workspace name)
  let brand: OgFonts['brand'] = null
  if (overrides?.brandFontFamily && overrides?.brandFontUrl) {
    const custom = await extractTtfFromCssUrl(overrides.brandFontUrl)
    if (custom) {
      brand = { name: overrides.brandFontFamily, data: custom }
    }
  }

  return {
    heading: { name: headingName, data: headingData },
    body: { name: 'DM Sans', data: defaults.body },
    brand,
  }
}

/** Truncate text with ellipsis. */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - 1).trimEnd() + '…'
}
