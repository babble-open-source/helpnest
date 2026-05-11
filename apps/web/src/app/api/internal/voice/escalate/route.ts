import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { validateInternalSecret } from '@/lib/voice/internal-auth'

export async function POST(request: Request) {
  const authError = validateInternalSecret(request)
  if (authError) return authError

  const body = (await request.json()) as {
    workspaceId: string
    conversationId: string
    reason: string
  }

  if (!body.conversationId) {
    return NextResponse.json({ error: 'conversationId required' }, { status: 400 })
  }

  await prisma.conversation.update({
    where: { id: body.conversationId },
    data: { status: 'ESCALATED' },
  })

  await prisma.message.create({
    data: {
      conversationId: body.conversationId,
      role: 'SYSTEM',
      content: `Voice session escalated to human support. Reason: ${body.reason ?? 'Low confidence'}`,
    },
  })

  return NextResponse.json({ ok: true })
}
