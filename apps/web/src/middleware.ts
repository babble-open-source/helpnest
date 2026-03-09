import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const HELP_CENTER_DOMAIN = process.env.NEXT_PUBLIC_HELP_CENTER_DOMAIN ?? 'helpnest.cloud'

// Rewrite {slug}.helpnest.cloud/* → /{slug}/help/*
function handleSubdomain(req: NextRequest): NextResponse | null {
  const host = req.headers.get('host') ?? ''
  if (host.endsWith(`.${HELP_CENTER_DOMAIN}`) && !host.startsWith('www.')) {
    const slug = host.slice(0, host.length - HELP_CENTER_DOMAIN.length - 1)
    const { pathname, search } = req.nextUrl
    const url = req.nextUrl.clone()
    // Avoid double-prefixing if already rewritten
    if (!pathname.startsWith(`/${slug}/help`)) {
      url.pathname = `/${slug}/help${pathname === '/' ? '' : pathname}`
      url.search = search
      return NextResponse.rewrite(url)
    }
  }
  return null
}

export default auth((req: NextRequest & { auth: unknown }) => {
  // Public help center — subdomain routing, no auth required
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
