import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Session-Token, X-Visitor-Id, X-Workspace-Slug',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET(request: Request) {
  const visitorId = request.headers.get('X-Visitor-Id')?.trim() ?? ''
  const rawHeader = request.headers.get('X-Session-Token')?.trim() ?? ''
  const sessionTokens = rawHeader.split(',').map((t) => t.trim()).filter(Boolean)

  if (!visitorId && sessionTokens.length === 0) {
    return NextResponse.json(
      { error: 'Missing X-Visitor-Id or X-Session-Token header' },
      { status: 400, headers: CORS_HEADERS },
    )
  }

  // Resolve workspace ID from slug to scope queries and prevent cross-workspace data leakage
  const workspaceSlug =
    request.headers.get('X-Workspace-Slug')?.trim() ??
    new URL(request.url).searchParams.get('workspace')?.trim() ??
    ''

  let workspaceId: string | null = null
  if (workspaceSlug) {
    const ws = await prisma.workspace.findFirst({
      where: { slug: workspaceSlug },
      select: { id: true },
    })
    workspaceId = ws?.id ?? null
  }

  // Always scope by workspaceId when available; fall back to unscoped only if workspace cannot be resolved
  const where = workspaceId
    ? visitorId
      ? { visitorId, workspaceId }
      : { sessionToken: { in: sessionTokens }, workspaceId }
    : visitorId
      ? { visitorId }
      : { sessionToken: { in: sessionTokens } }

  const conversations = await prisma.conversation.findMany({
    where,
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
