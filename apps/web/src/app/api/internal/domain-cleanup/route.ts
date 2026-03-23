import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { prisma } from '@/lib/db'
import { findCustomHostname, deleteCustomHostname, isCloudflareEnabled } from '@/lib/cloudflare-saas'
import { kvDeleteDomain } from '@/lib/cloudflare-kv'

/**
 * POST /api/internal/domain-cleanup
 * Called by helpnest-cloud when a workspace is downgraded to FREE.
 * Deletes the custom hostname from Cloudflare and clears customDomain in DB.
 * Idempotent — safe to call multiple times.
 * Body: { workspaceId }
 */
export async function POST(request: Request) {
  // Require x-internal-secret — this is a destructive write endpoint,
  // so we refuse requests when the secret is not configured (unlike resolve-domain
  // which is read-only and can operate without auth).
  const configuredSecret = process.env.INTERNAL_SECRET
  if (!configuredSecret) {
    return NextResponse.json({ error: 'Internal secret not configured' }, { status: 503 })
  }
  const provided = request.headers.get('x-internal-secret')
  if (!provided) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const a = Buffer.from(provided)
  const b = Buffer.from(configuredSecret)
  const valid = a.length === b.length && timingSafeEqual(a, b)
  if (!valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { workspaceId } = (await request.json()) as { workspaceId?: string }
  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 })
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { customDomain: true },
  })

  // Idempotent — no domain to clean up
  if (!workspace?.customDomain) {
    return NextResponse.json({ cleaned: true, domain: null })
  }

  const domain = workspace.customDomain

  // Delete from Cloudflare if enabled
  if (isCloudflareEnabled()) {
    const hostname = await findCustomHostname(domain)
    if (hostname) {
      await deleteCustomHostname(hostname.id)
    }
  }

  // Clear from DB
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { customDomain: null },
  })
  kvDeleteDomain(domain).catch(() => {})

  console.info(`[domain-cleanup] Cleaned up custom domain "${domain}" for workspace ${workspaceId}`)

  return NextResponse.json({ cleaned: true, domain })
}
