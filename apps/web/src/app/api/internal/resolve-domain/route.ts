import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { prisma } from '@/lib/db'

/**
 * Internal endpoint — resolves a custom domain to its workspace slug.
 *
 * Called by the proxy (src/proxy.ts, Edge Runtime) which cannot query
 * Postgres directly. Returns the slug so the proxy can rewrite the request
 * to /{slug}/help.
 *
 * INTERNAL_SECRET must be set in the environment. When it is absent this route
 * returns 503 so that a misconfigured deployment fails closed rather than
 * allowing unauthenticated domain enumeration. Consistent with the pattern used
 * by the provision-workspace route.
 *
 * Self-hosted: the proxy calls this via NEXT_PUBLIC_APP_URL (loopback).
 * Cloud: same pattern, internal network call.
 */
export async function GET(request: Request) {
  // Require INTERNAL_SECRET to be configured — fail closed rather than allowing
  // unauthenticated domain enumeration when the env var is absent.
  const configuredSecret = process.env.INTERNAL_SECRET
  if (!configuredSecret) {
    return NextResponse.json({ error: 'Internal API not configured' }, { status: 503 })
  }

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
    }
  )
}
