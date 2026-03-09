/**
 * Theme utilities for the HelpNest web app.
 *
 * Theme data (definitions, types) come from the @helpnest/themes npm package.
 * This file adds app-specific helpers (notably getTheme fallback behavior).
 */

import {
  themes,
  getTheme as _getTheme,
  themeToCSS as _themeToCSS,
} from '@helpnest/themes'

export type { HelpNestTheme } from '@helpnest/themes'
export { themes } from '@helpnest/themes'

import type { HelpNestTheme } from '@helpnest/themes'

/** getTheme with a guaranteed fallback — package returns undefined on miss. */
export function getTheme(id: string): HelpNestTheme {
  return _getTheme(id) ?? themes[0]!
}

/** Re-exported wrapper for consistency in app imports. */
export function themeToCSS(theme: HelpNestTheme): string {
  return _themeToCSS(theme)
}
