import NextAuth from 'next-auth'
import { authConfig } from '@/lib/auth.config'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Use the Edge-safe config (no Node.js-only imports) so ioredis, bcrypt,
// and Prisma are never bundled into the Edge Runtime. The JWT is still
// readable because both instances share AUTH_SECRET.
const { auth } = NextAuth(authConfig)

const HELP_CENTER_DOMAIN = process.env.NEXT_PUBLIC_HELP_CENTER_DOMAIN ?? 'helpnest.cloud'

// Static custom domain (env var) — fast path, no DB lookup, no fetch.
// HELPNEST_CUSTOM_DOMAIN=support.acme.com + HELPNEST_CUSTOM_DOMAIN_SLUG=acme
// is the recommended approach for self-hosted single-workspace deployments.
const CUSTOM_DOMAIN = process.env.HELPNEST_CUSTOM_DOMAIN
const CUSTOM_DOMAIN_SLUG = process.env.HELPNEST_CUSTOM_DOMAIN_SLUG

// Base URL of this Next.js app — used by middleware to call the internal
// resolve-domain API (loopback). Must equal NEXT_PUBLIC_APP_URL / NEXTAUTH_URL.
// Using the env var (not req.nextUrl.origin) so the call always goes to the
// canonical server address, never to the incoming custom domain.
const APP_ORIGIN =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ??
  process.env.NEXTAUTH_URL?.replace(/\/$/, '') ??
  ''

function rewriteToHelp(req: NextRequest, slug: string): NextResponse | null {
  const { pathname, search } = req.nextUrl
  if (pathname.startsWith(`/${slug}/help`)) return null
  const url = req.nextUrl.clone()
  url.pathname = `/${slug}/help${pathname === '/' ? '' : pathname}`
  url.search = search
  return NextResponse.rewrite(url)
}

// Rewrite {slug}.helpnest.cloud/* → /{slug}/help/*
function handleSubdomain(req: NextRequest): NextResponse | null {
  const host = (req.headers.get('host') ?? '').split(':')[0] ?? ''
  if (host.endsWith(`.${HELP_CENTER_DOMAIN}`) && !host.startsWith('www.')) {
    const slug = host.slice(0, host.length - HELP_CENTER_DOMAIN.length - 1)
    return rewriteToHelp(req, slug)
  }
  return null
}

// Fast path — env var custom domain, no network call needed.
function handleCustomDomain(req: NextRequest): NextResponse | null {
  if (!CUSTOM_DOMAIN || !CUSTOM_DOMAIN_SLUG) return null
  const host = (req.headers.get('host') ?? '').split(':')[0] ?? ''
  if (host === CUSTOM_DOMAIN) {
    return rewriteToHelp(req, CUSTOM_DOMAIN_SLUG)
  }
  return null
}

/**
 * DB-backed custom domain resolution — for domains saved via the settings UI.
 *
 * Middleware (Edge Runtime) cannot query Postgres directly, so we call the
 * internal /api/internal/resolve-domain endpoint via fetch (loopback).
 *
 * This runs ONLY when the host is not a known subdomain and not covered by
 * the env var fast-path above, so regular traffic is unaffected.
 *
 * Self-hosted: loopback call to the same process via NEXT_PUBLIC_APP_URL.
 * A 2-second timeout ensures a slow DB never stalls the request.
 */
async function handleDBCustomDomain(req: NextRequest): Promise<NextResponse | null> {
  if (!APP_ORIGIN) return null

  const host = (req.headers.get('host') ?? '').split(':')[0]?.toLowerCase() ?? ''
  if (!host) return null

  // Skip hosts that are already handled by subdomain routing or env var.
  if (host.endsWith(`.${HELP_CENTER_DOMAIN}`) || host === CUSTOM_DOMAIN) return null

  // Skip the app's own domain and localhost — never treat those as custom domains.
  const appHost = APP_ORIGIN.replace(/^https?:\/\//, '').split(':')[0] ?? ''
  if (host === appHost || host === 'localhost' || host === '127.0.0.1') return null

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2000)

    const res = await fetch(
      `${APP_ORIGIN}/api/internal/resolve-domain?host=${encodeURIComponent(host)}`,
      { signal: controller.signal },
    )
    clearTimeout(timeout)

    if (!res.ok) return null
    const { slug } = await res.json() as { slug: string | null }
    if (!slug) return null

    return rewriteToHelp(req, slug)
  } catch {
    // Timeout or network error — let the request through unmodified.
    return null
  }
}

export default auth(async (req: NextRequest & { auth: unknown }) => {
  // 1. Env var custom domain — fast path, no network call (self-hosted / single domain)
  const customDomainResponse = handleCustomDomain(req)
  if (customDomainResponse) return customDomainResponse

  // 2. Subdomain routing for helpnest.cloud (cloud product)
  const subdomainResponse = handleSubdomain(req)
  if (subdomainResponse) return subdomainResponse

  // 3. DB-backed custom domain — for domains saved via the settings UI.
  //    Skipped for internal API calls to avoid recursion.
  if (!req.nextUrl.pathname.startsWith('/api/internal/')) {
    const dbDomainResponse = await handleDBCustomDomain(req)
    if (dbDomainResponse) return dbDomainResponse
  }

  const isLoggedIn = !!(req as { auth?: { user?: unknown } }).auth?.user
  const isDashboard = req.nextUrl.pathname.startsWith('/dashboard')

  if (isDashboard && !isLoggedIn) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
