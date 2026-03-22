/**
 * Normalise an asset URL by trimming whitespace and stripping trailing slashes.
 */
export function normalizeAssetUrl(value: string): string {
  return value.trim().replace(/\/+$/, '')
}

/**
 * Heuristic: does the string look like a favicon / touch-icon asset rather
 * than a full logo image?
 */
export function looksLikeFaviconAsset(value: string): boolean {
  const lower = value.toLowerCase()
  return (
    lower.includes('.ico') ||
    lower.includes('favicon') ||
    lower.includes('apple-touch-icon') ||
    lower.includes('mask-icon')
  )
}
