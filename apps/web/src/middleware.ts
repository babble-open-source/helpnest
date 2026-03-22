import createIntlMiddleware from 'next-intl/middleware'
import NextAuth from 'next-auth'
import { authConfig } from '@/lib/auth.config'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { routing } from '@/i18n/routing'
import { defaultLocale, locales, type Locale } from '@/i18n/config'

const { auth } = NextAuth(authConfig)

const intlMiddleware = createIntlMiddleware(routing)

// ---------------------------------------------------------------------------
// Domain routing helpers (previously in proxy.ts)
// ---------------------------------------------------------------------------

const HELP_CENTER_DOMAIN = process.env.NEXT_PUBLIC_HELP_CENTER_DOMAIN ?? 'helpnest.cloud'

const CUSTOM_DOMAIN = process.env.HELPNEST_CUSTOM_DOMAIN
const CUSTOM_DOMAIN_SLUG = process.env.HELPNEST_CUSTOM_DOMAIN_SLUG

const APP_ORIGIN =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ??
  process.env.NEXTAUTH_URL?.replace(/\/$/, '') ??
  ''

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

  if (pathWithoutLocale.startsWith(`/${slug}/help`)) return null
  if (pathWithoutLocale.startsWith('/api/')) return null
  if (pathWithoutLocale === '/widget.js') return null
  // App routes that should never be rewritten by subdomain routing
  const APP_PATHS = ['/dashboard', '/login', '/signup', '/onboarding', '/invite/']
  if (APP_PATHS.some((p) => pathWithoutLocale.startsWith(p))) return null
  if (pathWithoutLocale.startsWith('/imports/') || pathWithoutLocale === '/manifest.json' || pathWithoutLocale.match(/\.(png|ico|svg|jpg|jpeg|webp)$/)) return null

  const url = req.nextUrl.clone()
  url.pathname = `/${locale}/${slug}/help${pathWithoutLocale === '/' ? '' : pathWithoutLocale}`
  url.search = search
  return NextResponse.rewrite(url)
}

function handleSubdomain(req: NextRequest): NextResponse | null {
  const host = (req.headers.get('host') ?? '').split(':')[0] ?? ''
  if (host.endsWith(`.${HELP_CENTER_DOMAIN}`) && !host.startsWith('www.')) {
    const slug = host.slice(0, host.length - HELP_CENTER_DOMAIN.length - 1)
    // Skip the dashboard subdomain — that's the admin app, not a help center
    if (slug === 'dashboard') return null
    return rewriteToHelp(req, slug)
  }
  return null
}

function handleCustomDomain(req: NextRequest): NextResponse | null {
  if (!CUSTOM_DOMAIN || !CUSTOM_DOMAIN_SLUG) return null
  const host = (req.headers.get('host') ?? '').split(':')[0] ?? ''
  if (host === CUSTOM_DOMAIN) {
    return rewriteToHelp(req, CUSTOM_DOMAIN_SLUG)
  }
  return null
}

async function handleDBCustomDomain(req: NextRequest): Promise<NextResponse | null> {
  if (!APP_ORIGIN) return null
  const host = (req.headers.get('host') ?? '').split(':')[0]?.toLowerCase() ?? ''
  if (!host) return null
  if (host.endsWith(`.${HELP_CENTER_DOMAIN}`) || host === CUSTOM_DOMAIN) return null
  const appHost = APP_ORIGIN.replace(/^https?:\/\//, '').split(':')[0] ?? ''
  if (host === appHost || host === 'localhost' || host === '127.0.0.1') return null

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
    if (!res.ok) return null
    const { slug } = await res.json() as { slug: string | null }
    if (!slug) return null
    return rewriteToHelp(req, slug)
  } catch {
    return null
  }
}

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
// Middleware
// ---------------------------------------------------------------------------

export default auth(async (req) => {
  const host = req.headers.get('host') ?? ''

  // 1. Env var custom domain — fast path
  const customDomainResponse = handleCustomDomain(req)
  if (customDomainResponse) {
    return customDomainResponse
  }

  // 2. Subdomain routing for helpnest.cloud
  const subdomainResponse = handleSubdomain(req)
  if (subdomainResponse) return subdomainResponse

  // 3. DB-backed custom domain
  if (!req.nextUrl.pathname.startsWith('/api/internal/')) {
    const dbDomainResponse = await handleDBCustomDomain(req)
    if (dbDomainResponse) return dbDomainResponse
  }

  // 4. Auth check — redirect unauthenticated dashboard requests to login
  const authResponse = handleAuthRedirect(req)
  if (authResponse) return authResponse

  // 5. next-intl locale detection, redirect, and negotiation
  return intlMiddleware(req)
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|imports/|api/|.*\\.(?:png|ico|svg|jpg|jpeg|webp|json|xml|txt|webmanifest)$).*)'],
}
