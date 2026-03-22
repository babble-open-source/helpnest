import { NextResponse } from 'next/server'
import { auth, resolveSessionUserId } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createCheckoutSession } from '@/lib/cloud'

/**
 * POST /api/billing/checkout
 * Creates a Stripe checkout session by calling the cloud API.
 * Body: { workspaceId, plan }
 */
export async function POST(request: Request) {
  const session = await auth()
  const userId = await resolveSessionUserId(session)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json()) as {
    workspaceId?: string
    plan?: string
  }

  if (!body.workspaceId || !body.plan) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  if (!['PRO', 'BUSINESS'].includes(body.plan)) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
  }

  // Verify the user is an OWNER of this workspace
  const member = await prisma.member.findFirst({
    where: { userId, workspaceId: body.workspaceId, role: 'OWNER', deactivatedAt: null },
  })
  if (!member) {
    return NextResponse.json({ error: 'Only workspace owners can manage billing' }, { status: 403 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const url = await createCheckoutSession(
    body.workspaceId,
    body.plan as 'PRO' | 'BUSINESS',
    session?.user?.email ?? '',
    `${appUrl}/dashboard/billing?success=true`,
    `${appUrl}/dashboard/billing?cancelled=true`,
  )

  if (!url) {
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 502 })
  }

  return NextResponse.json({ url })
}
