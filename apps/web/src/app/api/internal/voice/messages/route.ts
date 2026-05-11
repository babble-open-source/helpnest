import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { validateInternalSecret } from '@/lib/voice/internal-auth'

export async function POST(request: Request) {
  const authError = validateInternalSecret(request)
  if (authError) return authError

  const body = (await request.json()) as {
    conversationId: string
    role: 'CUSTOMER' | 'AI'
    content: string
    sources?: { id: string; title: string; slug: string; collectionSlug: string }[]
  }

  if (!body.conversationId || !body.role || !body.content) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const message = await prisma.message.create({
    data: {
      conversationId: body.conversationId,
      role: body.role,
      content: body.content.slice(0, 10000),
      sources: body.sources ? body.sources : undefined,
    },
    select: { id: true },
  })

  if (body.role === 'CUSTOMER') {
    const conv = await prisma.conversation.findUnique({
      where: { id: body.conversationId },
      select: { subject: true },
    })
    if (!conv?.subject) {
      await prisma.conversation.update({
        where: { id: body.conversationId },
        data: { subject: body.content.slice(0, 200) },
      })
    }
  }

  return NextResponse.json({ messageId: message.id }, { status: 201 })
}
