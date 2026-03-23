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

/** Extract the primary font name from a CSS font-family stack. */
function extractPrimaryFontName(fontStack: string): string {
  const [primary = 'Instrument Serif'] = fontStack.split(',')
  return primary.trim().replace(/^['"]|['"]$/g, '')
}

/**
 * Load fonts for OG image generation.
 * Resolves the full workspace theme (themeId + fontPresetId + custom overrides)
 * so OG images always match the live help center typography.
 */
export async function loadFonts(
  themeId: string = 'default',
  overrides: WorkspaceFontOverrides = {},
): Promise<OgFonts> {
  const defaults = await loadDefaultFonts()
  const theme = resolveWorkspaceTheme(themeId, overrides)

  // Heading font — from resolved theme (includes preset + custom overrides)
  let headingName = extractPrimaryFontName(theme.fonts.heading)
  let headingData = defaults.heading
  if (theme.fonts.headingUrl) {
    const data = await extractTtfFromCssUrl(theme.fonts.headingUrl)
    if (data) headingData = data
  }

  // Body font — from resolved theme (includes preset + custom overrides)
  let bodyName = extractPrimaryFontName(theme.fonts.body)
  let bodyData = defaults.body
  if (theme.fonts.bodyUrl) {
    const data = await extractTtfFromCssUrl(theme.fonts.bodyUrl)
    if (data) bodyData = data
  }

  // Brand font — for workspace name in the branding bar
  let brand: OgFonts['brand'] = null
  const brandFamily = overrides.customBrandFontFamily?.trim() ?? ''
  const brandUrl = overrides.customBrandFontUrl?.trim() ?? ''
  if (brandFamily && brandUrl) {
    const data = await extractTtfFromCssUrl(brandUrl)
    if (data) brand = { name: brandFamily, data }
  }

  return {
    heading: { name: headingName, data: headingData },
    body: { name: bodyName, data: bodyData },
    brand,
  }
}

/** Truncate text with ellipsis. */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - 1).trimEnd() + '…'
}
