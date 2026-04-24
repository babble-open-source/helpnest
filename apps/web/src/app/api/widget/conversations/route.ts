import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Session-Token',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET(request: Request) {
  const rawHeader = request.headers.get('X-Session-Token')?.trim() ?? ''

  if (rawHeader.length === 0) {
    return NextResponse.json(
      { error: 'Missing X-Session-Token header' },
      { status: 400, headers: CORS_HEADERS },
    )
  }

  const sessionTokens = rawHeader.split(',').map((t) => t.trim()).filter(Boolean)

  const conversations = await prisma.conversation.findMany({
    where: { sessionToken: { in: sessionTokens } },
    select: {
      id: true,
      status: true,
      subject: true,
      createdAt: true,
      updatedAt: true,
      messages: {
        select: {
          content: true,
          role: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { updatedAt: 'desc' },
  })

  return NextResponse.json(
    {
      conversations: conversations.map((conv) => {
        const lastMsg = conv.messages[0] ?? null
        return {
          id: conv.id,
          status: conv.status,
          subject: conv.subject ?? null,
          lastMessage: lastMsg
            ? {
                content: lastMsg.content.slice(0, 100),
                role: lastMsg.role,
                createdAt: lastMsg.createdAt,
              }
            : null,
          createdAt: conv.createdAt,
          updatedAt: conv.updatedAt,
        }
      }),
    },
    { headers: CORS_HEADERS },
  )
}
