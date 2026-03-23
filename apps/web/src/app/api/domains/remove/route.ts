import { NextResponse } from 'next/server'
import { auth, resolveSessionUserId } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { resolveWorkspaceId } from '@/lib/workspace'
import { findCustomHostname, deleteCustomHostname, isCloudflareEnabled } from '@/lib/cloudflare-saas'
import { kvDeleteDomain } from '@/lib/cloudflare-kv'

/**
 * POST /api/domains/remove
 * Removes a custom domain — deletes from Cloudflare and clears the DB.
 * Body: { domain }
 */
export async function POST(request: Request) {
  const session = await auth()
  const userId = await resolveSessionUserId(session)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const workspaceId = await resolveWorkspaceId(userId)
  if (!workspaceId) {
    return NextResponse.json({ error: 'No workspace' }, { status: 404 })
  }

  const member = await prisma.member.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { role: true },
  })
  if (!member || !['OWNER', 'ADMIN'].includes(member.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const { domain } = (await request.json()) as { domain?: string }
  if (!domain?.trim()) {
    return NextResponse.json({ error: 'Domain is required' }, { status: 400 })
  }

  const cleanDomain = domain.trim().toLowerCase()

  // Ownership check — domain must belong to this workspace
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { customDomain: true },
  })
  if (workspace?.customDomain !== cleanDomain) {
    return NextResponse.json({ error: 'Domain not registered for this workspace.' }, { status: 404 })
  }

  // Delete from Cloudflare if enabled
  if (isCloudflareEnabled()) {
    const hostname = await findCustomHostname(cleanDomain)
    if (hostname) {
      await deleteCustomHostname(hostname.id)
    }
  }

  // Clear from DB
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { customDomain: null },
  })
  kvDeleteDomain(cleanDomain).catch(() => {})

  return NextResponse.json({ removed: true })
}
