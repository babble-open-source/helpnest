import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth-api'
import { runAgent, recordKnowledgeGap } from '@/lib/ai-agent'
import { isByok } from '@/lib/ai/resolve-provider'
import { checkLimit, incrementUsage } from '@/lib/cloud'
import { redis } from '@/lib/redis'
import { draftArticle } from '@/lib/article-drafter'
import type { ChatMessage } from '@/lib/ai/types'

// Widget-facing CORS (public, any origin)
const WIDGET_CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Session-Token',
}

// Message rate limiting: 30 messages per minute per session token.
// This is intentionally generous for normal chat flow while still providing
// a guard against scripted abuse.
const MSG_RATE_LIMIT_WINDOW_MS = 60_000
const MSG_RATE_LIMIT_MAX = 30
const msgRateBuckets = new Map<string, { count: number; resetAt: number }>()

async function checkMsgRateLimit(key: string): Promise<{ limited: boolean }> {
  if (redis) {
    try {
      const slot = Math.floor(Date.now() / MSG_RATE_LIMIT_WINDOW_MS)
      const redisKey = `rl:msg:${key}:${slot}`
      const count = await redis.incr(redisKey)
      if (count === 1) await redis.pexpire(redisKey, MSG_RATE_LIMIT_WINDOW_MS * 2)
      return { limited: count > MSG_RATE_LIMIT_MAX }
    } catch {
      // Fall through to in-memory fallback
    }
  }

  const now = Date.now()
  const current = msgRateBuckets.get(key)
  if (!current || current.resetAt <= now) {
    msgRateBuckets.set(key, { count: 1, resetAt: now + MSG_RATE_LIMIT_WINDOW_MS })
    return { limited: false }
  }
  if (current.count >= MSG_RATE_LIMIT_MAX) return { limited: true }
  current.count++
  return { limited: false }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: WIDGET_CORS_HEADERS })
}

// GET — Load message history (widget via sessionToken or dashboard via auth)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const sessionToken = request.headers.get('x-session-token')
  const url = new URL(request.url)
  const since = url.searchParams.get('since')

  let conversationWhere: Record<string, unknown>

  if (sessionToken) {
    conversationWhere = { id, sessionToken }
  } else {
    const authResult = await requireAuth(request)
    if (!authResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    conversationWhere = { id, workspaceId: authResult.workspaceId }
  }

  // Verify ownership before returning any messages.
  const conversation = await prisma.conversation.findFirst({
    where: conversationWhere,
    select: { id: true },
  })
  if (!conversation) {
    return NextResponse.json(
      { error: 'Conversation not found' },
      { status: 404, headers: WIDGET_CORS_HEADERS },
    )
  }

  const messageWhere: Record<string, unknown> = { conversationId: id }
  if (since) {
    const sinceDate = new Date(since)
    // Silently skip an invalid `since` value — return all messages rather than error.
    if (!isNaN(sinceDate.getTime())) {
      messageWhere.createdAt = { gt: sinceDate }
    }
  }

  const messages = await prisma.message.findMany({
    where: messageWhere,
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json({ messages }, { headers: WIDGET_CORS_HEADERS })
}

// POST — Send a message.
//
// Two distinct flows share this handler:
//
//   1. Customer message via widget (X-Session-Token header present):
//      - Validates session token ownership.
//      - Rate-limits by session token.
//      - Saves the customer message.
//      - Auto-sets the subject from the first message.
//      - Runs the AI agent and streams the response as SSE.
//      - Persists the AI reply, updates conversation metadata, records
//        knowledge gaps on low confidence.
//
//   2. Agent reply via dashboard (session cookie or API key auth):
//      - Validates workspace membership.
//      - Saves the reply as role=AGENT.
//      - Resets ESCALATED → ACTIVE to signal agent engagement.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const sessionToken = request.headers.get('x-session-token')

  let body: { content?: string; role?: string }
  try {
    body = (await request.json()) as { content?: string; role?: string }
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400, headers: WIDGET_CORS_HEADERS },
    )
  }

  // Truncate at 2000 chars — matches the DB column length and guards against
  // oversized payloads inflating context windows.
  const content = body.content?.trim()?.slice(0, 2000)
  if (!content) {
    return NextResponse.json(
      { error: 'content is required' },
      { status: 400, headers: WIDGET_CORS_HEADERS },
    )
  }

  // =========================================================================
  // Flow 1: Customer message via widget
  // =========================================================================
  if (sessionToken) {
    const rate = await checkMsgRateLimit(sessionToken)
    if (rate.limited) {
      return NextResponse.json(
        { error: 'Too many messages' },
        { status: 429, headers: WIDGET_CORS_HEADERS },
      )
    }

    const conversation = await prisma.conversation.findFirst({
      where: { id, sessionToken },
      select: {
        id: true,
        status: true,
        subject: true,
        workspaceId: true,
        workspace: {
          select: {
            name: true,
            aiEnabled: true,
            aiProvider: true,
            aiApiKey: true,
            aiModel: true,
            aiInstructions: true,
            aiEscalationThreshold: true,
            autoDraftGapsEnabled: true,
            autoDraftGapThreshold: true,
          },
        },
      },
    })
    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404, headers: WIDGET_CORS_HEADERS },
      )
    }

    // Save the customer message first so it's persisted even if AI fails.
    const customerMessage = await prisma.message.create({
      data: {
        conversationId: id,
        role: 'CUSTOMER',
        content,
      },
    })

    // Auto-set the conversation subject from the first customer message so the
    // dashboard inbox has a readable title without requiring the customer to type one.
    if (!conversation.subject) {
      const msgCount = await prisma.message.count({ where: { conversationId: id } })
      if (msgCount === 1) {
        await prisma.conversation.update({
          where: { id },
          data: { subject: content.slice(0, 200) },
        })
      }
    }

    // If AI is disabled or the conversation is already in a terminal/human state,
    // return the saved customer message immediately without running the agent.
    if (
      !conversation.workspace.aiEnabled ||
      conversation.status === 'ESCALATED' ||
      conversation.status === 'HUMAN_ACTIVE' ||
      conversation.status === 'RESOLVED_HUMAN' ||
      conversation.status === 'RESOLVED_AI' ||
      conversation.status === 'CLOSED'
    ) {
      return NextResponse.json({ message: customerMessage }, { headers: WIDGET_CORS_HEADERS })
    }

    // Load full conversation history for multi-turn context.
    const history: Array<{ role: string; content: string }> = await prisma.message.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: 'asc' },
      select: { role: true, content: true },
    })

    // Map DB roles to the provider-agnostic user/assistant roles.
    const chatMessages: ChatMessage[] = history.map((m) => ({
      role: m.role === 'CUSTOMER' ? ('user' as const) : ('assistant' as const),
      content: m.content,
    }))

    // Check AI credit quota per message — BYOK allowed for self-hosted, PRO, BUSINESS
    const creditLimit = await checkLimit(conversation.workspaceId, 'aiCredits')
    const byokAllowed = creditLimit.plan === 'SELF_HOSTED' || (creditLimit.plan !== 'FREE')
    if (!isByok({ aiApiKey: conversation.workspace.aiApiKey }, { byok: byokAllowed })) {
      if (!creditLimit.allowed) {
        return NextResponse.json(
          { error: 'AI credit limit reached for this month. Upgrade your plan or add your own API key.' },
          { status: 429, headers: WIDGET_CORS_HEADERS },
        )
      }
      incrementUsage(conversation.workspaceId, 'aiCredits')
    }

    const agentCtx = {
      workspaceId: conversation.workspaceId,
      workspaceName: conversation.workspace.name,
      conversationId: id,
      aiProvider: conversation.workspace.aiProvider,
      aiApiKey: conversation.workspace.aiApiKey,
      aiModel: conversation.workspace.aiModel,
      aiInstructions: conversation.workspace.aiInstructions,
      aiEscalationThreshold: conversation.workspace.aiEscalationThreshold,
    }

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          let aiResponseText = ''
          let sources: unknown[] = []
          let confidence = 0.5
          let shouldEscalate = false
          let escalationReason: string | undefined

          for await (const event of runAgent(agentCtx, chatMessages)) {
            if (event.type === 'text') {
              aiResponseText += event.text
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: 'text', text: event.text })}\n\n`,
                ),
              )
            } else if (event.type === 'done') {
              // The done event from AgentStreamEvent carries metadata fields.
              const doneEvent = event as typeof event & {
                sources?: unknown[]
                confidence?: number
                shouldEscalate?: boolean
                escalationReason?: string
              }
              sources = doneEvent.sources ?? []
              confidence = doneEvent.confidence ?? 0.5
              shouldEscalate = doneEvent.shouldEscalate ?? false
              escalationReason = doneEvent.escalationReason
            } else if (event.type === 'error') {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: 'error', message: event.message })}\n\n`,
                ),
              )
            }
          }

          // Persist the AI reply only if we got substantive text.
          if (aiResponseText) {
            await prisma.message.create({
              data: {
                conversationId: id,
                role: 'AI',
                content: aiResponseText,
                sources: sources.length > 0 ? (sources as never) : undefined,
                confidence,
              },
            })
          }

          // Update conversation metadata in a single write.
          const updateData: Record<string, unknown> = { aiConfidence: confidence }
          if (shouldEscalate) {
            updateData.status = 'ESCALATED'
            updateData.escalationReason = escalationReason ?? null
            // Add a visible system message so the inbox shows why the conversation escalated.
            await prisma.message.create({
              data: {
                conversationId: id,
                role: 'SYSTEM',
                content: escalationReason
                  ? `Conversation escalated to human support: ${escalationReason}`
                  : 'Conversation escalated to human support.',
              },
            })
          }
          await prisma.conversation.update({ where: { id }, data: updateData })

          // Record a knowledge gap when confidence is very low — signals content
          // the KB is missing that would have resolved this question.
          // Use the same threshold as escalation so gaps and escalations stay in sync.
          if (confidence < (conversation.workspace.aiEscalationThreshold ?? 0.3)) {
            const gap = await recordKnowledgeGap(conversation.workspaceId, content).catch(() => null)
            if (
              gap &&
              conversation.workspace.autoDraftGapsEnabled &&
              gap.occurrences >= (conversation.workspace.autoDraftGapThreshold ?? 2) &&
              !gap.resolvedArticleId
            ) {
              void draftArticle({
                workspaceId: conversation.workspaceId,
                gap: { id: gap.id, query: gap.query },
              }).catch(() => {})
            }
          }

          // Send sources then the terminal done event.
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'sources', sources })}\n\n`),
          )
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'done',
                confidence,
                shouldEscalate,
                escalationReason,
              })}\n\n`,
            ),
          )
        } catch (err) {
          const message = err instanceof Error ? err.message : 'AI service error'
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'error', message })}\n\n`),
          )
        } finally {
          controller.close()
        }
      },
    })

    return new Response(readable, {
      headers: {
        ...WIDGET_CORS_HEADERS,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  }

  // =========================================================================
  // Flow 2: Agent reply via dashboard
  // =========================================================================
  const authResult = await requireAuth(request)
  if (!authResult) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const conversation = await prisma.conversation.findFirst({
    where: { id, workspaceId: authResult.workspaceId },
    select: { id: true, status: true },
  })
  if (!conversation) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  }

  const message = await prisma.message.create({
    data: {
      conversationId: id,
      role: 'AGENT',
      content,
    },
  })

  // When an agent replies to an escalated conversation, move to HUMAN_ACTIVE
  // so the AI stays off while the human continues the conversation.
  if (conversation.status === 'ESCALATED' || conversation.status === 'ACTIVE') {
    await prisma.conversation.update({
      where: { id },
      data: { status: 'HUMAN_ACTIVE' },
    })
  }

  return NextResponse.json({ message })
}
