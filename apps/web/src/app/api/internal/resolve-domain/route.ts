import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { prisma } from '@/lib/db'

/**
 * Internal endpoint — resolves a custom domain to its workspace slug.
 *
 * Called by middleware (Edge Runtime) which cannot query Postgres directly.
 * Returns the slug so middleware can rewrite the request to /{slug}/help.
 *
 * This route is intentionally unauthenticated: workspace slugs are public
 * (visible in every help center URL) and the host parameter is attacker-
 * controlled anyway, so there is no sensitive data to protect here.
 *
 * Self-hosted: the middleware calls this via NEXT_PUBLIC_APP_URL (loopback).
 * Cloud: same pattern, internal network call.
 */
export async function GET(request: Request) {
  // When INTERNAL_SECRET is configured, require it to prevent unauthenticated
  // enumeration of custom domains. The middleware always sends the header.
  const configuredSecret = process.env.INTERNAL_SECRET
  if (configuredSecret) {
    const provided = request.headers.get('x-internal-secret')
    if (!provided) {
      return NextResponse.json({ slug: null }, { status: 401 })
    }
    // Pad to equal length before timingSafeEqual to avoid leaking secret length via timing
    const maxLen = Math.max(provided.length, configuredSecret.length) || 1
    const a = Buffer.alloc(maxLen)
    const b = Buffer.alloc(maxLen)
    Buffer.from(provided).copy(a)
    Buffer.from(configuredSecret).copy(b)
    const valid = provided.length === configuredSecret.length && timingSafeEqual(a, b)
    if (!valid) {
      return NextResponse.json({ slug: null }, { status: 401 })
    }
  }

  const host = new URL(request.url).searchParams.get('host')?.toLowerCase().trim()
  if (!host) return NextResponse.json({ slug: null })

  // deletedAt filter is not needed here — soft-deleted workspaces have
  // customDomain cleared to null by the delete route, so they won't match.
  const workspace = await prisma.workspace.findFirst({
    where: { customDomain: host },
    select: { slug: true },
  })

  return NextResponse.json(
    { slug: workspace?.slug ?? null },
    {
      headers: {
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=60',
      },
    },
  )
}
