import { headers } from 'next/headers'

/**
 * Returns the external base URL when the help center is served via a
 * subdomain or custom domain rewrite (e.g. "https://help.example.com").
 * Returns null for path-based routing (self-hosted without domain routing).
 *
 * The middleware sets x-helpnest-base-url on rewrite responses.
 */
export async function getHelpBaseUrl(): Promise<string | null> {
  const h = await headers()
  return h.get('x-helpnest-base-url') || null
}

/**
 * Build a help center path. When on a custom domain/subdomain, returns
 * a clean path like "/collection/article". When on path-based routing,
 * returns the full "/{workspace}/help/collection/article" path.
 */
export function buildHelpPath(
  workspaceSlug: string,
  subPath: string,
  externalBaseUrl: string | null,
): string {
  if (externalBaseUrl) {
    // Custom domain / subdomain — clean path without /{slug}/help prefix
    return subPath.startsWith('/') ? subPath : `/${subPath}`
  }
  // Path-based routing (self-hosted)
  const clean = subPath.startsWith('/') ? subPath : `/${subPath}`
  return `/${workspaceSlug}/help${clean === '/' ? '' : clean}`
}
