import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth-api'

// POST — Assign or unassign a conversation to a workspace member.
//
// Passing { memberId: null } (or omitting memberId) clears the assignment.
// Passing a memberId validates it belongs to the same workspace before updating,
// preventing cross-workspace assignment via a manipulated ID.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const authResult = await requireAuth(request)
  if (!authResult) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { memberId?: string | null }
  try {
    body = (await request.json()) as { memberId?: string | null }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const conversation = await prisma.conversation.findFirst({
    where: { id, workspaceId: authResult.workspaceId },
    select: { id: true },
  })
  if (!conversation) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  }

  // When a memberId is supplied, verify it belongs to the same workspace.
  // This guard prevents assigning a conversation to a member of a different
  // workspace via a valid but cross-tenant ID.
  if (body.memberId) {
    const member = await prisma.member.findFirst({
      where: { id: body.memberId, workspaceId: authResult.workspaceId },
      select: { id: true },
    })
    if (!member) {
      return NextResponse.json(
        { error: 'Member not found in this workspace' },
        { status: 404 },
      )
    }
  }

  const updated = await prisma.conversation.update({
    where: { id },
    data: { assignedToId: body.memberId ?? null },
    include: {
      assignedTo: {
        select: { id: true, user: { select: { name: true, email: true } } },
      },
    },
  })

  return NextResponse.json(updated)
}
