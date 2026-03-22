import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth-api'
import { redis } from '@/lib/redis'
import { checkLimit } from '@/lib/cloud'
import { isByok } from '@/lib/ai/resolve-provider'

// Widget-facing CORS (public, any origin)
const WIDGET_CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

// Dashboard-facing responses omit permissive CORS — same-origin only


// Rate limiting for conversation creation: 10/min per IP
const CONV_RATE_LIMIT_WINDOW_MS = 60_000
const CONV_RATE_LIMIT_MAX = 10
const convRateBuckets = new Map<string, { count: number; resetAt: number }>()

function getClientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip')?.trim() ||
    'unknown'
  )
}

async function checkConvRateLimit(
  key: string,
): Promise<{ limited: boolean; retryAfterSeconds: number }> {
  if (redis) {
    try {
      const slot = Math.floor(Date.now() / CONV_RATE_LIMIT_WINDOW_MS)
      const redisKey = `rl:conv:${key}:${slot}`
      const count = await redis.incr(redisKey)
      if (count === 1) await redis.pexpire(redisKey, CONV_RATE_LIMIT_WINDOW_MS * 2)
      if (count > CONV_RATE_LIMIT_MAX) {
        const windowEnd = (slot + 1) * CONV_RATE_LIMIT_WINDOW_MS
        return {
          limited: true,
          retryAfterSeconds: Math.max(1, Math.ceil((windowEnd - Date.now()) / 1000)),
        }
      }
      return { limited: false, retryAfterSeconds: 0 }
    } catch {
      // Fall through to in-memory fallback
    }
  }

  const now = Date.now()

  // Best-effort cleanup to prevent unbounded memory growth in long-lived processes.
  if (convRateBuckets.size > 10_000) {
    for (const [k, b] of convRateBuckets) if (b.resetAt <= now) convRateBuckets.delete(k)
  }

  const current = convRateBuckets.get(key)
  if (!current || current.resetAt <= now) {
    convRateBuckets.set(key, { count: 1, resetAt: now + CONV_RATE_LIMIT_WINDOW_MS })
    return { limited: false, retryAfterSeconds: 0 }
  }
  if (current.count >= CONV_RATE_LIMIT_MAX) {
    return {
      limited: true,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    }
  }
  current.count++
  return { limited: false, retryAfterSeconds: 0 }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: WIDGET_CORS_HEADERS })
}

// POST — Create conversation (widget, no auth required)
export async function POST(request: Request) {
  const ip = getClientIp(request)
  const rate = await checkConvRateLimit(ip)
  if (rate.limited) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again shortly.' },
      {
        status: 429,
        headers: { ...WIDGET_CORS_HEADERS, 'Retry-After': String(rate.retryAfterSeconds) },
      },
    )
  }

  let body: { workspaceSlug?: string; customerName?: string; customerEmail?: string }
  try {
    body = (await request.json()) as {
      workspaceSlug?: string
      customerName?: string
      customerEmail?: string
    }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400, headers: WIDGET_CORS_HEADERS })
  }

  const { workspaceSlug, customerName, customerEmail } = body
  if (!workspaceSlug) {
    return NextResponse.json(
      { error: 'workspaceSlug is required' },
      { status: 400, headers: WIDGET_CORS_HEADERS },
    )
  }

  const workspace = await prisma.workspace.findUnique({
    where: { slug: workspaceSlug, deletedAt: null },
    select: { id: true, aiEnabled: true, aiGreeting: true, aiProvider: true, aiApiKey: true },
  })
  if (!workspace) {
    return NextResponse.json(
      { error: 'Workspace not found' },
      { status: 404, headers: WIDGET_CORS_HEADERS },
    )
  }

  // Pre-check AI credit quota to reject early if exhausted.
  // Actual credit consumption happens per-message in /conversations/[id]/messages
  // when the AI agent runs — not here (conversation creation is just a container).
  const limit = await checkLimit(workspace.id, 'aiCredits')
  const byokAllowed = limit.plan === 'SELF_HOSTED' || limit.plan === 'PRO' || limit.plan === 'BUSINESS'
  if (!isByok({ aiApiKey: workspace.aiApiKey }, { byok: byokAllowed })) {
    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'AI credit limit reached for this month. Upgrade your plan or add your own API key.' },
        { status: 429, headers: WIDGET_CORS_HEADERS },
      )
    }
  }

  const conversation = await prisma.conversation.create({
    data: {
      workspaceId: workspace.id,
      customerName: customerName?.slice(0, 200) || null,
      customerEmail: customerEmail?.slice(0, 320) || null,
    },
    select: {
      id: true,
      sessionToken: true,
      status: true,
      createdAt: true,
    },
  })

  // AI credits are consumed per-message in /conversations/[id]/messages, not here

  return NextResponse.json(
    {
      id: conversation.id,
      sessionToken: conversation.sessionToken,
      status: conversation.status,
      aiEnabled: workspace.aiEnabled,
      greeting: workspace.aiGreeting || 'Hi! How can I help you today?',
      createdAt: conversation.createdAt,
    },
    { status: 201, headers: WIDGET_CORS_HEADERS },
  )
}

// GET — List conversations (dashboard, auth required)
export async function GET(request: Request) {
  const authResult = await requireAuth(request)
  if (!authResult) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const status = url.searchParams.get('status')
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10))
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)))
  const skip = (page - 1) * limit

  const where: Record<string, unknown> = { workspaceId: authResult.workspaceId }
  if (status) {
    where.status = status
  }

  type ConversationRow = {
    id: string
    status: string
    customerName: string | null
    customerEmail: string | null
    subject: string | null
    aiConfidence: number | null
    escalationReason: string | null
    assignedTo: { user: { name: string | null; email: string } } | null
    messages: Array<{ content: string; role: string }>
    _count: { messages: number }
    createdAt: Date
    updatedAt: Date
  }
  const [conversations, total]: [ConversationRow[], number] = await Promise.all([
    prisma.conversation.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip,
      take: limit,
      include: {
        messages: {
          take: 1,
          orderBy: { createdAt: 'asc' },
          select: { content: true, role: true },
        },
        assignedTo: {
          select: {
            user: { select: { name: true, email: true } },
          },
        },
        _count: { select: { messages: true } },
      },
    }),
    prisma.conversation.count({ where }),
  ])

  return NextResponse.json({
    data: conversations.map((c) => ({
      id: c.id,
      status: c.status,
      customerName: c.customerName,
      customerEmail: c.customerEmail,
      subject: c.subject,
      aiConfidence: c.aiConfidence,
      escalationReason: c.escalationReason,
      assignedTo: c.assignedTo
        ? {
            name: c.assignedTo.user.name,
            email: c.assignedTo.user.email,
          }
        : null,
      firstMessage: c.messages[0]?.content?.slice(0, 200) || null,
      messageCount: c._count.messages,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    })),
    total,
    page,
    limit,
  })
}
