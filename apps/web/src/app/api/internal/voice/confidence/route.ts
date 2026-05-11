import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { validateInternalSecret } from '@/lib/voice/internal-auth'
import { recordKnowledgeGap } from '@/lib/ai-agent'

export async function POST(request: Request) {
  const authError = validateInternalSecret(request)
  if (authError) return authError

  const body = (await request.json()) as {
    workspaceId: string
    conversationId: string
    messageId: string
    confidence: number
    query: string
  }

  if (!body.workspaceId || !body.messageId || typeof body.confidence !== 'number') {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const message = await prisma.message.findUnique({
    where: { id: body.messageId },
    select: { id: true, conversationId: true, conversation: { select: { workspaceId: true } } },
  })

  if (!message) {
    return NextResponse.json({ error: 'Message not found' }, { status: 404 })
  }

  if (message.conversation.workspaceId !== body.workspaceId) {
    return NextResponse.json({ error: 'Workspace mismatch' }, { status: 400 })
  }

  if (body.conversationId && message.conversationId !== body.conversationId) {
    return NextResponse.json({ error: 'Conversation mismatch' }, { status: 400 })
  }

  await prisma.message
    .update({
      where: { id: body.messageId },
      data: { confidence: body.confidence },
    })
    .catch(() => {})

  const workspace = await prisma.workspace.findUnique({
    where: { id: body.workspaceId },
    select: {
      aiEscalationThreshold: true,
      autoDraftGapsEnabled: true,
      autoDraftGapThreshold: true,
    },
  })

  if (workspace && body.confidence < (workspace.aiEscalationThreshold ?? 0.3)) {
    const gap = await recordKnowledgeGap(body.workspaceId, body.query).catch(() => null)
    if (
      gap &&
      workspace.autoDraftGapsEnabled &&
      gap.occurrences >= (workspace.autoDraftGapThreshold ?? 2) &&
      !gap.resolvedArticleId
    ) {
      const { draftArticle } = await import('@/lib/article-drafter')
      void draftArticle({
        workspaceId: body.workspaceId,
        gap: { id: gap.id, query: gap.query },
      }).catch(() => {})
    }
  }

  return NextResponse.json({ ok: true })
}
