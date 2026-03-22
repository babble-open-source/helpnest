import { NextResponse } from 'next/server'
import { auth, resolveSessionUserId } from '@/lib/auth'
import { prisma } from '@/lib/db'

const RESTORE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

/**
 * POST /api/workspaces/restore
 * Restores a soft-deleted workspace. OWNER only, within 30 days.
 * Body: { workspaceId }
 */
export async function POST(request: Request) {
  const session = await auth()
  const userId = await resolveSessionUserId(session)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { workspaceId } = (await request.json()) as { workspaceId?: string }
  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 })
  }

  // Verify OWNER role (query without deletedAt filter since workspace is deleted)
  const member = await prisma.member.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { role: true },
  })
  if (!member || member.role !== 'OWNER') {
    return NextResponse.json({ error: 'Only the workspace owner can restore it' }, { status: 403 })
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { deletedAt: true, name: true },
  })
  if (!workspace) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  }
  if (!workspace.deletedAt) {
    return NextResponse.json({ error: 'Workspace is not deleted' }, { status: 400 })
  }

  // Check 30-day window
  const elapsed = Date.now() - workspace.deletedAt.getTime()
  if (elapsed > RESTORE_WINDOW_MS) {
    return NextResponse.json({ error: 'Restore window has expired (30 days)' }, { status: 410 })
  }

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { deletedAt: null },
  })

  return NextResponse.json({ restored: true, name: workspace.name })
}
