import { NextResponse } from 'next/server'
import { auth, resolveSessionUserId } from '@/lib/auth'
import { prisma } from '@/lib/db'

const RESTORE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000
const MANGLED_SLUG_RE = /--deleted-[a-z0-9]+$/

export async function GET(request: Request) {
  const session = await auth()
  const userId = await resolveSessionUserId(session)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const workspaceId = searchParams.get('workspaceId')
  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 })
  }

  const member = await prisma.member.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { role: true, deactivatedAt: true },
  })
  if (!member || member.deactivatedAt !== null || member.role !== 'OWNER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { slug: true, deletedAt: true },
  })
  if (!workspace || !workspace.deletedAt) {
    return NextResponse.json({ error: 'Workspace not found or not deleted' }, { status: 404 })
  }

  const elapsed = Date.now() - workspace.deletedAt.getTime()
  if (elapsed > RESTORE_WINDOW_MS) {
    return NextResponse.json({ error: 'Restore window expired' }, { status: 410 })
  }

  const isMangled = MANGLED_SLUG_RE.test(workspace.slug)

  return NextResponse.json({
    available: !isMangled,
    slug: workspace.slug,
    ...(isMangled ? { originalSlug: workspace.slug.replace(MANGLED_SLUG_RE, '') } : {}),
  })
}
