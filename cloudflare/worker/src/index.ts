/**
 * HelpNest BYOD Worker
 *
 * Sits on the Cloudflare for SaaS fallback origin (proxy.helpnest.cloud).
 * When a customer's custom domain (e.g. help.acme.com) is CNAMEd here,
 * Cloudflare for SaaS terminates SSL and routes the request to this Worker.
 *
 * The Worker rewrites the Host header to dashboard.helpnest.cloud (a domain
 * Railway knows about) and preserves the original hostname in X-Forwarded-Host
 * so the Next.js middleware can resolve it to a workspace slug.
 */

const ORIGIN = 'https://dashboard.helpnest.cloud'

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    // Preserve the original customer hostname for the Next.js middleware.
    // Cloudflare for SaaS may set X-Forwarded-Host already; fall back to Host.
    const originalHost =
      request.headers.get('X-Forwarded-Host') ||
      request.headers.get('Host') ||
      url.hostname

    // Rewrite to the Railway-known origin
    const newUrl = new URL(url.pathname + url.search, ORIGIN)

    const headers = new Headers(request.headers)
    headers.set('Host', 'dashboard.helpnest.cloud')
    headers.set('X-Forwarded-Host', originalHost)

    return fetch(newUrl, {
      method: request.method,
      headers,
      body: request.body,
      redirect: 'manual',
      // @ts-expect-error — required in Workers runtime for streaming request bodies
      duplex: 'half',
    })
  },
} satisfies ExportedHandler
