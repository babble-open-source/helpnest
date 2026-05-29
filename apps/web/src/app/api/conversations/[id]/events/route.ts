import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth-api'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

// GET /api/conversations/[id]/events
// Read-only audit timeline for a conversation.
// Query params:
//   ?since  — ISO 8601 timestamp; returns only events with createdAt > since
//   ?limit  — number of events to return; default 50, max 200; ordered asc
//
// No POST — event emission is handled server-side by emitConversationEvent.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const authResult = await requireAuth(request)
  if (!authResult) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify the conversation belongs to this workspace before returning any data.
  const conversation = await prisma.conversation.findFirst({
    where: { id, workspaceId: authResult.workspaceId },
    select: { id: true },
  })
  if (!conversation) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  }

  const { searchParams } = new URL(request.url)
  const sinceRaw = searchParams.get('since')
  const limitRaw = parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT), 10)
  const limit = Math.min(MAX_LIMIT, Math.max(1, isNaN(limitRaw) ? DEFAULT_LIMIT : limitRaw))

  const where: Record<string, unknown> = {
    conversationId: id,
    workspaceId: authResult.workspaceId,
  }

  if (sinceRaw) {
    const sinceDate = new Date(sinceRaw)
    if (isNaN(sinceDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid ?since value — must be a valid ISO 8601 timestamp' },
        { status: 400 }
      )
    }
    where.createdAt = { gt: sinceDate }
  }

  const events = await prisma.conversationEvent.findMany({
    where,
    orderBy: { createdAt: 'asc' },
    take: limit,
    include: {
      actorMember: {
        select: { id: true, user: { select: { name: true, email: true } } },
      },
    },
  })

  return NextResponse.json({ data: events })
}
