/**
 * Converts a string into a URL-safe slug.
 *
 * Used for article, collection, and other content slugs throughout the app.
 * Strips non-alphanumeric characters, lowercases, and truncates to 200 chars.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 200)
}
