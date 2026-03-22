import { NextResponse } from 'next/server'
import { auth, resolveSessionUserId } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { findCustomHostname, deleteCustomHostname, isCloudflareEnabled } from '@/lib/cloudflare-saas'
import { isCloudMode } from '@/lib/cloud'
import { qdrant, COLLECTION_NAME } from '@/lib/qdrant'

/**
 * POST /api/workspaces/delete
 * Soft-deletes a workspace. OWNER only.
 * Body: { workspaceId, confirmName }
 */
export async function POST(request: Request) {
  const session = await auth()
  const userId = await resolveSessionUserId(session)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { workspaceId, confirmName } = (await request.json()) as {
    workspaceId?: string
    confirmName?: string
  }

  if (!workspaceId || !confirmName?.trim()) {
    return NextResponse.json({ error: 'workspaceId and confirmName are required' }, { status: 400 })
  }

  // Verify OWNER role
  const member = await prisma.member.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { role: true },
  })
  if (!member || member.role !== 'OWNER') {
    return NextResponse.json({ error: 'Only the workspace owner can delete it' }, { status: 403 })
  }

  // Fetch workspace and verify name confirmation
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { name: true, customDomain: true, deletedAt: true },
  })
  if (!workspace) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  }
  if (workspace.deletedAt) {
    return NextResponse.json({ error: 'Workspace is already deleted' }, { status: 409 })
  }
  if (workspace.name.toLowerCase() !== confirmName.trim().toLowerCase()) {
    return NextResponse.json({ error: 'Workspace name does not match' }, { status: 400 })
  }

  // Soft delete
  const restoreDeadline = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { deletedAt: new Date() },
  })

  // Clean up external resources (fire-and-forget, don't block response)

  // 1. Cloudflare custom hostname
  if (workspace.customDomain && isCloudflareEnabled()) {
    findCustomHostname(workspace.customDomain)
      .then((hostname) => {
        if (hostname) return deleteCustomHostname(hostname.id)
      })
      .catch((err) => console.error('[workspace-delete] Cloudflare cleanup error:', err))
  }
  if (workspace.customDomain) {
    prisma.workspace.update({
      where: { id: workspaceId },
      data: { customDomain: null },
    }).catch(() => {})
  }

  // 2. Qdrant vectors
  if (qdrant) {
    qdrant.delete(COLLECTION_NAME, {
      filter: {
        must: [{ key: 'workspaceId', match: { value: workspaceId } }],
      },
    }).catch((err) => console.error('[workspace-delete] Qdrant cleanup error:', err))
  }

  // 3. Cancel Stripe subscription via cloud
  if (isCloudMode()) {
    const CLOUD_API_URL = process.env.CLOUD_API_URL
    const INTERNAL_SECRET = process.env.INTERNAL_SECRET
    if (CLOUD_API_URL && CLOUD_API_URL !== 'http://localhost:3002') {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (INTERNAL_SECRET) headers['x-internal-secret'] = INTERNAL_SECRET
      fetch(`${CLOUD_API_URL}/api/workspaces/${workspaceId}`, {
        method: 'DELETE',
        headers,
      }).catch((err) => console.error('[workspace-delete] Cloud cancellation error:', err))
    }
  }

  return NextResponse.json({
    deleted: true,
    restoreDeadline: restoreDeadline.toISOString(),
  })
}
