import { NextResponse } from 'next/server'
import { auth, resolveSessionUserId } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { isDemoMode } from '@/lib/demo'
import { resolveWorkspaceId } from '@/lib/workspace'

/**
 * DELETE /api/api-keys/:id
 * Deletes the specified API key. The key must belong to the authenticated user's
 * workspace. Requires OWNER or ADMIN role.
 */
export async function DELETE(
  _req: Request,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const [session, params] = await Promise.all([auth(), paramsPromise])
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = await resolveSessionUserId(session)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspaceId = await resolveWorkspaceId(userId)
  if (!workspaceId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const member = await prisma.member.findFirst({
    where: {
      userId,
      workspaceId,
      deactivatedAt: null,
      role: { in: ['OWNER', 'ADMIN'] },
    },
    select: { workspaceId: true },
  })
  if (!member) {
    return NextResponse.json({ error: 'Forbidden — OWNER or ADMIN required' }, { status: 403 })
  }

  if (isDemoMode()) {
    return NextResponse.json({ error: 'API key management is disabled in demo mode.' }, { status: 403 })
  }

  // Verify the key belongs to this workspace before deleting.
  const apiKey = await prisma.apiKey.findFirst({
    where: { id: params.id, workspaceId: member.workspaceId },
    select: { id: true },
  })
  if (!apiKey) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await prisma.apiKey.delete({ where: { id: params.id } })

  return new NextResponse(null, { status: 204 })
}
