/**
 * Allowlist of trusted font CDN hosts.
 *
 * Font URLs are injected as <link rel="stylesheet"> in the help center,
 * so they must be restricted to prevent CSS injection attacks.
 */
const ALLOWED_FONT_HOSTS = [
  'fonts.googleapis.com',
  'fonts.bunny.net',
  'use.typekit.net',
  'fonts.cdnfonts.com',
]

/**
 * Validates that a font URL is HTTPS and from a trusted CDN.
 * Returns true for empty/null values (treated as "no font URL").
 */
export function isAllowedFontUrl(value: string | null | undefined): boolean {
  if (!value || value.trim().length === 0) return true
  try {
    const url = new URL(value.trim())
    return url.protocol === 'https:' && ALLOWED_FONT_HOSTS.includes(url.hostname)
  } catch {
    return false
  }
}
