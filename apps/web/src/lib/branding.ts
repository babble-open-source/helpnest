import { getTheme, themeToCSS, themes, type HelpNestTheme } from '@/lib/themes'

export interface FontPreset {
  id: string
  name: string
  headingLabel: string
  bodyLabel: string
  fonts: HelpNestTheme['fonts']
}

export const radiusOptions: HelpNestTheme['radius'][] = ['none', 'sm', 'md', 'lg', 'xl']
export const colorOverrideKeys = [
  'cream',
  'ink',
  'muted',
  'border',
  'accent',
  'green',
  'white',
] as const
export type ColorOverrideKey = typeof colorOverrideKeys[number]

export interface WorkspaceFontOverrides {
  fontPresetId?: string | null
  brandText?: string | null
  customCreamColor?: string | null
  customInkColor?: string | null
  customMutedColor?: string | null
  customBorderColor?: string | null
  customAccentColor?: string | null
  customGreenColor?: string | null
  customWhiteColor?: string | null
  customRadius?: HelpNestTheme['radius'] | null
  customHeadingFontFamily?: string | null
  customHeadingFontUrl?: string | null
  customBodyFontFamily?: string | null
  customBodyFontUrl?: string | null
  customBrandFontFamily?: string | null
  customBrandFontUrl?: string | null
}

function quoteFontFamily(fontFamily: string): string {
  const trimmed = fontFamily.trim()
  if (trimmed.length === 0) return trimmed
  if (trimmed.startsWith('"') || trimmed.startsWith("'") || trimmed.includes(',')) return trimmed
  return `"${trimmed.replace(/"/g, '\\"')}"`
}

function primaryFontLabel(fontFamily: string): string {
  const [primary = 'Sans Serif'] = fontFamily.split(',')
  return primary.trim().replace(/^['"]|['"]$/g, '')
}

const presetMap = new Map<string, FontPreset>()

for (const theme of themes) {
  const key = JSON.stringify(theme.fonts)
  if (presetMap.has(key)) continue

  presetMap.set(key, {
    id: theme.id,
    name: theme.name,
    headingLabel: primaryFontLabel(theme.fonts.heading),
    bodyLabel: primaryFontLabel(theme.fonts.body),
    fonts: theme.fonts,
  })
}

export const fontPresets = Array.from(presetMap.values())

export function getFontPreset(id?: string | null): FontPreset | undefined {
  if (!id) return undefined
  return fontPresets.find((preset) => preset.id === id)
}

export function resolveWorkspaceTheme(themeId: string, overrides: WorkspaceFontOverrides = {}): HelpNestTheme {
  const baseTheme = getTheme(themeId)
  const fontPreset = getFontPreset(overrides.fontPresetId)
  const customHeadingFamily = overrides.customHeadingFontFamily?.trim() ?? ''
  const customHeadingUrl = overrides.customHeadingFontUrl?.trim() || undefined
  const customBodyFamily = overrides.customBodyFontFamily?.trim() ?? ''
  const customBodyUrl = overrides.customBodyFontUrl?.trim() || undefined

  const theme = fontPreset
    ? {
        ...baseTheme,
        fonts: fontPreset.fonts,
      }
    : baseTheme

  const nextTheme: HelpNestTheme = {
    ...theme,
    colors: {
      cream: overrides.customCreamColor?.trim() || theme.colors.cream,
      ink: overrides.customInkColor?.trim() || theme.colors.ink,
      muted: overrides.customMutedColor?.trim() || theme.colors.muted,
      border: overrides.customBorderColor?.trim() || theme.colors.border,
      accent: overrides.customAccentColor?.trim() || theme.colors.accent,
      green: overrides.customGreenColor?.trim() || theme.colors.green,
      white: overrides.customWhiteColor?.trim() || theme.colors.white,
    },
    radius: overrides.customRadius ?? theme.radius,
    fonts: { ...theme.fonts },
  }

  const nextFonts: HelpNestTheme['fonts'] = { ...nextTheme.fonts }

  if (customHeadingFamily.length > 0) {
    const family = quoteFontFamily(customHeadingFamily)
    nextFonts.heading = `${family}, ${theme.fonts.heading}`
    nextFonts.headingUrl = customHeadingUrl
  }

  if (customBodyFamily.length > 0) {
    const family = quoteFontFamily(customBodyFamily)
    nextFonts.body = `${family}, ${theme.fonts.body}`
    nextFonts.bodyUrl = customBodyUrl
  }
  nextTheme.fonts = nextFonts
  return nextTheme
}

export function getWorkspaceBrandFontStack(
  themeId: string,
  overrides: WorkspaceFontOverrides = {},
): string | null {
  const customBrandFamily = overrides.customBrandFontFamily?.trim() ?? ''
  if (customBrandFamily.length === 0) return null

  const theme = resolveWorkspaceTheme(themeId, overrides)
  return `${quoteFontFamily(customBrandFamily)}, ${theme.fonts.heading}`
}

export function getWorkspaceThemeCSS(themeId: string, overrides: WorkspaceFontOverrides = {}): string {
  const theme = resolveWorkspaceTheme(themeId, overrides)
  const brandFontStack = getWorkspaceBrandFontStack(themeId, overrides)
  const baseCss = themeToCSS(theme)

  return brandFontStack ? `${baseCss}; --font-brand: ${brandFontStack}` : baseCss
}

export function getWorkspaceFontUrls(themeId: string, overrides: WorkspaceFontOverrides = {}): string[] {
  const theme = resolveWorkspaceTheme(themeId, overrides)
  const customBrandFontUrl = overrides.customBrandFontUrl?.trim() || undefined

  return Array.from(
    new Set(
      [theme.fonts.headingUrl, theme.fonts.bodyUrl, customBrandFontUrl].filter(
        (url): url is string => Boolean(url),
      ),
    ),
  )
}

export function getAllFontPresetUrls(): string[] {
  return Array.from(
    new Set(
      fontPresets.flatMap((preset) =>
        [preset.fonts.headingUrl, preset.fonts.bodyUrl].filter((url): url is string => Boolean(url)),
      ),
    ),
  )
}
