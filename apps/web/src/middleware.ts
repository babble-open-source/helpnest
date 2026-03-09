import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const HELP_CENTER_DOMAIN = process.env.NEXT_PUBLIC_HELP_CENTER_DOMAIN ?? 'helpnest.cloud'

// Custom domain support for self-hosted deployments.
// Set HELPNEST_CUSTOM_DOMAIN=support.trybabble.io and
// HELPNEST_CUSTOM_DOMAIN_SLUG=babble in your .env to map an
// arbitrary domain to a workspace without a DB lookup in the Edge runtime.
const CUSTOM_DOMAIN = process.env.HELPNEST_CUSTOM_DOMAIN
const CUSTOM_DOMAIN_SLUG = process.env.HELPNEST_CUSTOM_DOMAIN_SLUG

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

// Rewrite custom domain → workspace help center (self-hosted / cloud custom domains)
function handleCustomDomain(req: NextRequest): NextResponse | null {
  if (!CUSTOM_DOMAIN || !CUSTOM_DOMAIN_SLUG) return null
  const host = (req.headers.get('host') ?? '').split(':')[0] ?? ''
  if (host === CUSTOM_DOMAIN) {
    return rewriteToHelp(req, CUSTOM_DOMAIN_SLUG)
  }
  return null
}

export default auth((req: NextRequest & { auth: unknown }) => {
  // Custom domain takes priority (self-hosted deployments)
  const customDomainResponse = handleCustomDomain(req)
  if (customDomainResponse) return customDomainResponse

  // Subdomain routing for helpnest.cloud (cloud product)
  const subdomainResponse = handleSubdomain(req)
  if (subdomainResponse) return subdomainResponse

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
