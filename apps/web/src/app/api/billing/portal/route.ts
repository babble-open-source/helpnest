import { NextResponse } from 'next/server'
import { auth, resolveSessionUserId } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getPortalUrl } from '@/lib/cloud'

/**
 * POST /api/billing/portal
 * Gets a Stripe customer portal URL by calling the cloud API.
 * Body: { workspaceId }
 */
export async function POST(request: Request) {
  const session = await auth()
  const userId = await resolveSessionUserId(session)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json()) as { workspaceId?: string }
  if (!body.workspaceId) {
    return NextResponse.json({ error: 'Missing workspaceId' }, { status: 400 })
  }

  // Verify the user is an OWNER of this workspace
  const member = await prisma.member.findFirst({
    where: { userId, workspaceId: body.workspaceId, role: 'OWNER', deactivatedAt: null },
  })
  if (!member) {
    return NextResponse.json({ error: 'Only workspace owners can manage billing' }, { status: 403 })
  }

  const url = await getPortalUrl(body.workspaceId)
  if (!url) {
    return NextResponse.json({ error: 'Failed to get portal URL' }, { status: 502 })
  }

  return NextResponse.json({ url })
}
