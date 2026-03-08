/**
 * Theme utilities for the HelpNest web app.
 *
 * Theme data (definitions, types) come from the @helpnest/themes npm package.
 * This file adds the server-side CSS generation needed to inject themes into
 * Next.js layouts via <style dangerouslySetInnerHTML>.
 */

import {
  themes,
  getTheme as _getTheme,
} from '@helpnest/themes'

export type { HelpNestTheme } from '@helpnest/themes'
export { themes } from '@helpnest/themes'

import type { HelpNestTheme } from '@helpnest/themes'

/** getTheme with a guaranteed fallback — package returns undefined on miss. */
export function getTheme(id: string): HelpNestTheme {
  return _getTheme(id) ?? themes[0]!
}

/** Convert a hex color like #F7F4EE to space-separated RGB channels "247 244 238" */
function hexToChannels(hex: string): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `${r} ${g} ${b}`
}

const radiusScale: Record<HelpNestTheme['radius'], string> = {
  none: '0px',
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '16px',
}

/**
 * Generate the CSS variable block for a theme.
 * Colors are output as RGB channels so Tailwind opacity utilities work (e.g. bg-cream/90).
 * Fonts use --font-heading/--font-body which Tailwind's font-serif/font-sans read.
 * Injected into layouts via <style dangerouslySetInnerHTML>.
 */
export function themeToCSS(theme: HelpNestTheme): string {
  const { colors, fonts } = theme
  return [
    `--color-cream: ${hexToChannels(colors.cream)};`,
    `--color-ink: ${hexToChannels(colors.ink)};`,
    `--color-muted: ${hexToChannels(colors.muted)};`,
    `--color-border: ${hexToChannels(colors.border)};`,
    `--color-accent: ${hexToChannels(colors.accent)};`,
    `--color-green: ${hexToChannels(colors.green)};`,
    `--color-white: ${hexToChannels(colors.white)};`,
    `--font-heading: ${fonts.heading};`,
    `--font-body: ${fonts.body};`,
    `--radius: ${radiusScale[theme.radius]};`,
  ].join(' ')
}
