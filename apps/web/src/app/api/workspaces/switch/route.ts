import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { auth, resolveSessionUserId } from '@/lib/auth'
import { prisma } from '@/lib/db'

/**
 * POST /api/workspaces/switch
 * Sets the active workspace cookie.
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
    return NextResponse.json({ error: 'workspaceId required' }, { status: 400 })
  }

  // Verify the user is a member of this workspace
  const member = await prisma.member.findFirst({
    where: { userId, workspaceId, deactivatedAt: null },
  })
  if (!member) {
    return NextResponse.json({ error: 'Not a member of this workspace' }, { status: 403 })
  }

  const cookieStore = await cookies()
  cookieStore.set('helpnest-workspace', workspaceId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 365 * 24 * 60 * 60, // 1 year
  })

  return NextResponse.json({ ok: true })
}
