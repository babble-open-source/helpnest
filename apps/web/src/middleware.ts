import createIntlMiddleware from 'next-intl/middleware'
import NextAuth from 'next-auth'
import { authConfig } from '@/lib/auth.config'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { routing } from '@/i18n/routing'
import { defaultLocale, locales, type Locale } from '@/i18n/config'
import { getRequestHostname } from '@/lib/request-host'

const { auth } = NextAuth(authConfig)

const intlMiddleware = createIntlMiddleware(routing)

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HELP_CENTER_DOMAIN = process.env.NEXT_PUBLIC_HELP_CENTER_DOMAIN ?? 'helpnest.cloud'

const CUSTOM_DOMAIN = process.env.HELPNEST_CUSTOM_DOMAIN
const CUSTOM_DOMAIN_SLUG = process.env.HELPNEST_CUSTOM_DOMAIN_SLUG

const APP_ORIGIN =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ??
  process.env.NEXTAUTH_URL?.replace(/\/$/, '') ??
  ''

const APP_HOST = APP_ORIGIN.replace(/^https?:\/\//, '').split(':')[0] ?? ''

// ---------------------------------------------------------------------------
// Error pages — static HTML returned directly from middleware (no Next.js)
// ---------------------------------------------------------------------------

const NOT_FOUND_HTML = `<!DOCTYPE html>
<html>
<head><title>Help Center Not Found</title></head>
<body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#F7F4EE;color:#1A1814">
<div style="text-align:center;max-width:400px">
<p style="font-size:48px;margin-bottom:16px">&#x1FAB9;</p>
<h1 style="font-size:24px;margin-bottom:8px">Help center not found</h1>
<p style="color:#7A756C;font-size:14px">This help center could not be found. If you just set up this domain, it may take a few minutes to activate.</p>
</div></body></html>`

const UNAVAILABLE_HTML = `<!DOCTYPE html>
<html>
<head><title>Temporarily Unavailable</title><meta http-equiv="refresh" content="5"></head>
<body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#F7F4EE;color:#1A1814">
<div style="text-align:center;max-width:400px">
<p style="font-size:48px;margin-bottom:16px">&#x23F3;</p>
<h1 style="font-size:24px;margin-bottom:8px">Temporarily unavailable</h1>
<p style="color:#7A756C;font-size:14px">This help center is temporarily unavailable. Retrying automatically...</p>
</div></body></html>`

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function detectLocaleFromPath(pathname: string): Locale {
  const segments = pathname.split('/').filter(Boolean)
  const firstSegment = segments[0]
  if (firstSegment && locales.includes(firstSegment as Locale)) {
    return firstSegment as Locale
  }
  return defaultLocale
}

function rewriteToHelp(req: NextRequest, slug: string): NextResponse | null {
  const { pathname, search } = req.nextUrl
  const locale = detectLocaleFromPath(pathname)
  const pathWithoutLocale = pathname.replace(new RegExp(`^/${locale}`), '') || '/'

  // Path already contains the internal /<slug>/help prefix — let it through
  if (pathWithoutLocale.startsWith(`/${slug}/help`)) return null
  if (pathWithoutLocale.startsWith('/api/')) return null
  if (pathWithoutLocale === '/widget.js') return null
  // App routes that should never be rewritten by subdomain routing
  const APP_PATHS = ['/dashboard', '/login', '/signup', '/onboarding', '/invite/']
  if (APP_PATHS.some((p) => pathWithoutLocale.startsWith(p))) return null
  if (pathWithoutLocale.startsWith('/imports/') || pathWithoutLocale === '/manifest.json' || pathWithoutLocale.match(/\.(png|ico|svg|jpg|jpeg|webp)$/)) return null

  const host = getRequestHostname(req.headers)
  const externalBaseUrl = `https://${host}`

  // Build rewrite URL using the forwarded host (X-Forwarded-Host) — this is
  // what Next.js considers the "real" incoming origin. Using req.url would give
  // us Railway's internal host (dashboard.helpnest.cloud), creating a cross-
  // origin rewrite that Next.js converts to a 308 redirect loop.
  const forwardedHost = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
  const proto = APP_ORIGIN.startsWith('https') ? 'https' : 'http'
  const rewriteBase = forwardedHost
    ? `${proto}://${forwardedHost}`
    : req.url
  const rewritePath = `/${locale}/${slug}/help${pathWithoutLocale === '/' ? '' : pathWithoutLocale}`
  const rewriteUrl = new URL(rewritePath + (search || ''), rewriteBase)
  const response = NextResponse.rewrite(rewriteUrl)
  response.headers.set('x-helpnest-base-url', externalBaseUrl)
  return response
}

function isKnownHost(host: string): boolean {
  return (
    host === APP_HOST ||
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host.endsWith(`.${HELP_CENTER_DOMAIN}`) ||
    host === HELP_CENTER_DOMAIN
  )
}

// ---------------------------------------------------------------------------
// Step 1: Env var custom domain (self-hosted fast path)
// ---------------------------------------------------------------------------

function handleCustomDomain(req: NextRequest): NextResponse | null {
  if (!CUSTOM_DOMAIN || !CUSTOM_DOMAIN_SLUG) return null
  const host = getRequestHostname(req.headers)
  if (host === CUSTOM_DOMAIN.toLowerCase()) {
    return rewriteToHelp(req, CUSTOM_DOMAIN_SLUG)
  }
  return null
}

// ---------------------------------------------------------------------------
// Step 2: Subdomain routing (*.helpnest.cloud)
// ---------------------------------------------------------------------------

function handleSubdomain(req: NextRequest): NextResponse | null {
  const host = getRequestHostname(req.headers)
  if (host.endsWith(`.${HELP_CENTER_DOMAIN}`) && !host.startsWith('www.')) {
    const slug = host.slice(0, host.length - HELP_CENTER_DOMAIN.length - 1)
    if (slug === 'dashboard') return null
    return rewriteToHelp(req, slug)
  }
  return null
}

// ---------------------------------------------------------------------------
// Step 4: BYOD fallback — API fetch when KV missed (terminal for BYOD)
// ---------------------------------------------------------------------------

async function handleDBCustomDomain(req: NextRequest): Promise<NextResponse | null> {
  if (!APP_ORIGIN) return null

  // Only run for BYOD requests that came through the Worker without a slug
  const hasHelpNestHost = !!req.headers.get('x-helpnest-host')

  const host = getRequestHostname(req.headers)
  if (!host) return hasHelpNestHost ? new NextResponse(NOT_FOUND_HTML, { status: 404, headers: { 'Content-Type': 'text/html' } }) : null
  if (host.endsWith(`.${HELP_CENTER_DOMAIN}`) || host === CUSTOM_DOMAIN?.toLowerCase()) return null
  if (isKnownHost(host) && !hasHelpNestHost) return null

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2000)
    const res = await fetch(
      `${APP_ORIGIN}/api/internal/resolve-domain?host=${encodeURIComponent(host)}`,
      {
        signal: controller.signal,
        headers: process.env.INTERNAL_SECRET
          ? { 'X-Internal-Secret': process.env.INTERNAL_SECRET }
          : {},
      },
    )
    clearTimeout(timeout)

    if (!res.ok) {
      // API error — if BYOD, show error page; otherwise fall through
      return hasHelpNestHost
        ? new NextResponse(UNAVAILABLE_HTML, { status: 503, headers: { 'Content-Type': 'text/html', 'Retry-After': '5' } })
        : null
    }

    const { slug } = await res.json() as { slug: string | null }
    if (!slug) {
      // Domain not found in DB
      return hasHelpNestHost
        ? new NextResponse(NOT_FOUND_HTML, { status: 404, headers: { 'Content-Type': 'text/html' } })
        : null
    }

    const rewrite = rewriteToHelp(req, slug)
    if (rewrite) return rewrite

    // Path already has the /{slug}/help prefix — run intlMiddleware for locale
    const dbLocale = detectLocaleFromPath(req.nextUrl.pathname)
    const dbPWL = req.nextUrl.pathname.replace(new RegExp(`^/${dbLocale}`), '') || '/'
    if (dbPWL.startsWith(`/${slug}/help`)) {
      const response = intlMiddleware(req)
      response.headers.set('x-helpnest-base-url', `https://${host}`)
      return response
    }

    // BYOD domain hitting a non-help path — return 404
    return hasHelpNestHost
      ? new NextResponse(NOT_FOUND_HTML, { status: 404, headers: { 'Content-Type': 'text/html' } })
      : null
  } catch {
    // Timeout or network error
    return hasHelpNestHost
      ? new NextResponse(UNAVAILABLE_HTML, { status: 503, headers: { 'Content-Type': 'text/html', 'Retry-After': '5' } })
      : null
  }
}

// ---------------------------------------------------------------------------
// Step 6: Auth redirect
// ---------------------------------------------------------------------------

function handleAuthRedirect(
  req: NextRequest & { auth?: unknown },
): NextResponse | null {
  const authData = req.auth as { user?: unknown } | null | undefined
  const isLoggedIn = !!authData?.user
  const { pathname } = req.nextUrl
  const locale = detectLocaleFromPath(pathname)
  const pathWithoutLocale = pathname.replace(new RegExp(`^/${locale}`), '') || '/'

  if (pathWithoutLocale.startsWith('/dashboard') && !isLoggedIn) {
    return NextResponse.redirect(new URL(`/${locale}/login`, req.url))
  }
  return null
}

// ---------------------------------------------------------------------------
// Middleware — 7-step routing pipeline
// ---------------------------------------------------------------------------

export default auth(async (req) => {
  // 0. Widget script — bypass all routing and serve directly via rewrite
  if (req.nextUrl.pathname === '/widget.js') {
    return NextResponse.rewrite(new URL('/api/widget.js', req.url))
  }

  // 1. Env var custom domain — fast path (self-hosted)
  const customDomainResponse = handleCustomDomain(req)
  if (customDomainResponse) return customDomainResponse

  // 2. Subdomain routing (*.helpnest.cloud)
  const subdomainResponse = handleSubdomain(req)
  if (subdomainResponse) return subdomainResponse

  // 3. BYOD fast path — slug resolved at edge by Cloudflare Worker KV
  // Only trust x-helpnest-slug when x-helpnest-host is also present (both set
  // by the Worker). Without this, direct requests to Railway could spoof the slug.
  const byodSlug = req.headers.get('x-helpnest-host') ? req.headers.get('x-helpnest-slug') : null
  if (byodSlug) {
    const rewrite = rewriteToHelp(req, byodSlug)
    if (rewrite) return rewrite

    // rewriteToHelp returns null when the path already has /${slug}/help —
    // this happens when the request was previously redirected to the internal
    // path. Let it through so Next.js can render the page.
    const { pathname: byodPath } = req.nextUrl
    const byodLocale = detectLocaleFromPath(byodPath)
    const byodPWL = byodPath.replace(new RegExp(`^/${byodLocale}`), '') || '/'
    if (byodPWL.startsWith(`/${byodSlug}/help`)) {
      const byodHost = getRequestHostname(req.headers)
      // Run intlMiddleware so next-intl can resolve the locale from the URL
      // (without this, locale switching via the LanguageSwitcher breaks)
      const response = intlMiddleware(req)
      response.headers.set('x-helpnest-base-url', `https://${byodHost}`)
      return response
    }

    // BYOD domain hitting a non-help path (e.g. /dashboard) — block it
    return new NextResponse(NOT_FOUND_HTML, { status: 404, headers: { 'Content-Type': 'text/html' } })
  }

  // 4. BYOD fallback — KV missed, try API fetch (terminal for BYOD requests)
  // Note: /api/ paths are excluded by the matcher, so this always runs.
  const dbDomainResponse = await handleDBCustomDomain(req)
  if (dbDomainResponse) return dbDomainResponse

  // 5. Unknown host guard — block unrecognized external hosts that bypassed
  //    the Worker (no X-HelpNest-Host header) and aren't known app hosts.
  //    Uses raw header check, NOT getRequestHostname() which normalizes away
  //    the distinction between Worker-proxied and direct-access requests.
  if (!req.headers.get('x-helpnest-host')) {
    const host = getRequestHostname(req.headers)
    if (!isKnownHost(host)) {
      return new NextResponse(NOT_FOUND_HTML, { status: 404, headers: { 'Content-Type': 'text/html' } })
    }
  }

  // 6. Cloud path redirect — helpnest.cloud/en/<slug>/help → <slug>.helpnest.cloud
  // Only runs in production (HTTPS) — skip for local dev (http://localhost)
  if (process.env.NEXT_PUBLIC_HELP_CENTER_DOMAIN && APP_ORIGIN.startsWith('https://')) {
    const host = getRequestHostname(req.headers)
    if (host === APP_HOST) {
      const { pathname } = req.nextUrl
      const locale = detectLocaleFromPath(pathname)
      const pathWithoutLocale = pathname.replace(new RegExp(`^/${locale}`), '') || '/'
      const helpMatch = pathWithoutLocale.match(/^\/([^/]+)\/help(?:\/|$)/)
      if (helpMatch) {
        const slug = helpMatch[1]
        const restPath = pathWithoutLocale.replace(`/${slug}/help`, '') || ''
        return NextResponse.redirect(
          `https://${slug}.${HELP_CENTER_DOMAIN}${restPath}${req.nextUrl.search}`,
          308,
        )
      }
    }
  }

  // 7. Auth check + next-intl locale handling
  const authResponse = handleAuthRedirect(req)
  if (authResponse) return authResponse

  return intlMiddleware(req)
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|imports/|api/|.*\\.(?:png|ico|svg|jpg|jpeg|webp|json|webmanifest)$).*)'],
}
