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
// Font loading — cached at module level (fetched once per server process)
// ---------------------------------------------------------------------------

const INSTRUMENT_SERIF_URL =
  'https://fonts.gstatic.com/s/instrumentserif/v5/jizBRFtNs2ka5fXjeivQ4LroWlx-2zI.ttf'
const DM_SANS_URL =
  'https://fonts.gstatic.com/s/dmsans/v17/rP2tp2ywxg089UriI5-g4vlH9VoD8CmcqZG40F9JadbnoEwAopxhTg.ttf'

let fontsPromise: Promise<{ instrumentSerif: ArrayBuffer; dmSans: ArrayBuffer }> | null = null

export function loadFonts() {
  if (!fontsPromise) {
    fontsPromise = Promise.all([
      fetch(INSTRUMENT_SERIF_URL).then((r) => r.arrayBuffer()),
      fetch(DM_SANS_URL).then((r) => r.arrayBuffer()),
    ]).then(([instrumentSerif, dmSans]) => ({ instrumentSerif, dmSans }))
  }
  return fontsPromise
}

/** Truncate text with ellipsis. */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - 1).trimEnd() + '…'
}
