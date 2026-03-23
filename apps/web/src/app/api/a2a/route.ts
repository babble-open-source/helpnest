/**
 * A2A (Agent-to-Agent) JSON-RPC 2.0 endpoint.
 *
 * Implements Google's A2A protocol v0.2.0 as a thin protocol adapter over
 * HelpNest's existing conversation infrastructure. An A2A "task" maps 1:1 to a
 * HelpNest Conversation; task state is derived from the conversation's status.
 *
 * Supported methods:
 *   message/send          — non-streaming: run AI agent, return completed task
 *   message/send-streaming — SSE stream of task status and artifact events
 *   tasks/get             — retrieve a task (conversation) by ID
 *   tasks/cancel          — close a conversation, marking the task canceled
 *
 * Authentication: Bearer API key via Authorization header (same keys as the
 * REST API — validated by requireAuth via validateApiKey).
 *
 * Error codes follow JSON-RPC 2.0 (-32700..-32600) for protocol errors and
 * A2A-spec custom codes (-32001) for domain errors.
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth-api'
import { runAgent } from '@/lib/ai-agent'
import { isByok } from '@/lib/ai/resolve-provider'
import { checkLimit, incrementUsage } from '@/lib/cloud'
import type { ChatMessage } from '@/lib/ai/types'

// ── A2A Types ─────────────────────────────────────────────────────────────────

interface JsonRpcRequest {
  jsonrpc: '2.0'
  id: string | number
  method: string
  params?: Record<string, unknown>
}

interface A2ATextPart {
  type: 'text'
  text: string
}

interface A2AMessage {
  role: 'user' | 'agent'
  parts: A2ATextPart[]
}

interface A2AArtifact {
  name?: string
  description?: string
  parts: Array<{
    type: 'text'
    text: string
    metadata?: Record<string, unknown>
  }>
  index: number
  append?: boolean
  lastChunk?: boolean
  metadata?: Record<string, unknown>
}

type A2ATaskState =
  | 'submitted'
  | 'working'
  | 'completed'
  | 'failed'
  | 'canceled'
  | 'input-required'

interface A2ATask {
  id: string
  status: {
    state: A2ATaskState
    message?: A2AMessage
  }
  artifacts?: A2AArtifact[]
  history?: A2AMessage[]
}

// ── JSON-RPC error codes ───────────────────────────────────────────────────────

const PARSE_ERROR = -32700
const INVALID_REQUEST = -32600
const METHOD_NOT_FOUND = -32601
const INVALID_PARAMS = -32602
const INTERNAL_ERROR = -32603
// A2A-specific
const TASK_NOT_FOUND = -32001

// ── CORS headers ───────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function jsonRpcSuccess(id: string | number, result: unknown) {
  return NextResponse.json({ jsonrpc: '2.0', id, result }, { headers: CORS_HEADERS })
}

function jsonRpcError(id: string | number | null, code: number, message: string) {
  return NextResponse.json(
    { jsonrpc: '2.0', id, error: { code, message } },
    { headers: CORS_HEADERS },
  )
}

/**
 * Derives the A2A task state from the Prisma conversation status.
 *
 * ACTIVE → working: the AI agent is still engaged.
 * RESOLVED_AI / RESOLVED_HUMAN → completed: terminal success state.
 * CLOSED → canceled: terminal cancelled state.
 * ESCALATED / HUMAN_ACTIVE → input-required: the task needs human input to proceed.
 * All others default to 'working' as a safe forward-compatible fallback.
 */
function conversationStatusToA2A(status: string): A2ATaskState {
  switch (status) {
    case 'ACTIVE':
      return 'working'
    case 'RESOLVED_AI':
    case 'RESOLVED_HUMAN':
      return 'completed'
    case 'CLOSED':
      return 'canceled'
    case 'ESCALATED':
    case 'HUMAN_ACTIVE':
      return 'input-required'
    default:
      return 'working'
  }
}

/**
 * Builds an A2ATask from a conversation row, optionally including full message
 * history and derived artifacts from AI responses.
 *
 * When includeHistory is false (tasks/get without history flag) only the
 * status is materialised — avoids a large message query on hot paths.
 */
async function conversationToTask(
  conversationId: string,
  workspaceId: string,
  includeHistory: boolean,
): Promise<A2ATask | null> {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, workspaceId },
    select: {
      id: true,
      status: true,
    },
  })

  if (!conversation) return null

  const state = conversationStatusToA2A(conversation.status)
  const task: A2ATask = { id: conversation.id, status: { state } }

  if (!includeHistory) return task

  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
    select: { role: true, content: true, sources: true },
  })

  task.history = messages
    // SYSTEM messages are internal; don't expose them to A2A clients.
    .filter((m) => m.role !== 'SYSTEM')
    .map((m) => ({
      role: m.role === 'CUSTOMER' ? ('user' as const) : ('agent' as const),
      parts: [{ type: 'text' as const, text: m.content }],
    }))

  // Build artifacts from AI responses only — customer messages are not artifacts.
  const aiMessages = messages.filter((m) => m.role === 'AI')
  if (aiMessages.length > 0) {
    task.artifacts = aiMessages.map((m, i) => ({
      parts: [
        {
          type: 'text' as const,
          text: m.content,
          metadata: m.sources ? { sources: m.sources } : undefined,
        },
      ],
      index: i,
      lastChunk: true,
    }))
  }

  return task
}

// ── CORS preflight ─────────────────────────────────────────────────────────────

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

// ── Main POST handler ──────────────────────────────────────────────────────────

export async function POST(request: Request) {
  // Authenticate before touching the body — fail fast on missing/invalid keys.
  const authResult = await requireAuth(request)
  if (!authResult) {
    return jsonRpcError(
      null,
      INVALID_REQUEST,
      'Unauthorized — provide a valid API key via Authorization: Bearer header',
    )
  }

  let rpc: JsonRpcRequest
  try {
    rpc = (await request.json()) as JsonRpcRequest
  } catch {
    return jsonRpcError(null, PARSE_ERROR, 'Invalid JSON')
  }

  // Validate envelope — id is required so every error response carries it back.
  if (rpc.jsonrpc !== '2.0' || !rpc.method || rpc.id === undefined || rpc.id === null) {
    return jsonRpcError(
      (rpc as Partial<JsonRpcRequest>)?.id ?? null,
      INVALID_REQUEST,
      'Invalid JSON-RPC 2.0 request — jsonrpc, id, and method are required',
    )
  }

  const { workspaceId } = authResult

  switch (rpc.method) {
    // ── message/send ────────────────────────────────────────────────────────
    case 'message/send': {
      const params = rpc.params ?? {}
      const message = params.message as A2AMessage | undefined
      // params.id is the existing task (conversation) ID for multi-turn exchanges.
      const taskId = params.id as string | undefined

      if (!message?.parts?.length) {
        return jsonRpcError(rpc.id, INVALID_PARAMS, 'message with parts is required')
      }

      const textPart = message.parts.find((p) => p.type === 'text')
      if (!textPart?.text?.trim()) {
        return jsonRpcError(rpc.id, INVALID_PARAMS, 'message must contain a non-empty text part')
      }

      const content = textPart.text.trim().slice(0, 2000)

      // ── Resolve workspace and conversation ───────────────────────────────

      // Fetch workspace AI settings up-front regardless of whether we're
      // creating or continuing a conversation — we need them to run the agent.
      const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: {
          id: true,
          name: true,
          aiEnabled: true,
          aiProvider: true,
          aiApiKey: true,
          aiModel: true,
          aiInstructions: true,
          aiEscalationThreshold: true,
        },
      })
      if (!workspace) {
        return jsonRpcError(rpc.id, INTERNAL_ERROR, 'Workspace not found')
      }

      // Check AI credit quota — BYOK allowed for self-hosted, PRO, BUSINESS
      const creditLimit = await checkLimit(workspace.id, 'aiCredits')
      const byokAllowed = creditLimit.plan === 'SELF_HOSTED' || creditLimit.plan === 'PRO' || creditLimit.plan === 'BUSINESS'
      if (!isByok({ aiApiKey: workspace.aiApiKey }, { byok: byokAllowed })) {
        if (!creditLimit.allowed) {
          return jsonRpcError(rpc.id, INTERNAL_ERROR, 'AI credit limit reached for this month')
        }
        incrementUsage(workspace.id, 'aiCredits')
      }

      let conversationId: string

      if (taskId) {
        // Continue an existing conversation / A2A task.
        const existing = await prisma.conversation.findFirst({
          where: { id: taskId, workspaceId },
          select: { id: true },
        })
        if (!existing) {
          return jsonRpcError(rpc.id, TASK_NOT_FOUND, `Task ${taskId} not found`)
        }
        conversationId = existing.id
      } else {
        // Start a new conversation. Subject is derived from the first message
        // so the inbox is readable without requiring the caller to supply one.
        const created = await prisma.conversation.create({
          data: {
            workspaceId,
            subject: content.slice(0, 200),
            customerName: 'A2A Agent',
          },
          select: { id: true },
        })
        conversationId = created.id
      }

      // Persist the customer turn before running the agent so the message
      // survives even if the agent call throws.
      await prisma.message.create({
        data: { conversationId, role: 'CUSTOMER', content },
      })

      // If AI is not enabled, park the task in working state so a human can
      // pick it up in the inbox. A2A clients should poll tasks/get or subscribe
      // to a push notification channel (not yet implemented).
      if (!workspace.aiEnabled) {
        const task = await conversationToTask(conversationId, workspaceId, true)
        // conversationToTask can only return null if the row was deleted between
        // the create above and this query — treat as internal error.
        if (!task) {
          return jsonRpcError(rpc.id, INTERNAL_ERROR, 'Failed to retrieve created task')
        }
        return jsonRpcSuccess(rpc.id, task)
      }

      // Load full conversation history for multi-turn context.
      const history = await prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
        select: { role: true, content: true },
      })

      const chatMessages: ChatMessage[] = history.map((m) => ({
        role: m.role === 'CUSTOMER' ? ('user' as const) : ('assistant' as const),
        content: m.content,
      }))

      const agentCtx = {
        workspaceId: workspace.id,
        workspaceName: workspace.name,
        conversationId,
        // aiProvider is an AiProvider enum in Prisma; AgentContext accepts string | null.
        aiProvider: workspace.aiProvider as string | null,
        aiApiKey: workspace.aiApiKey,
        aiModel: workspace.aiModel,
        aiInstructions: workspace.aiInstructions,
        aiEscalationThreshold: workspace.aiEscalationThreshold,
        includeInternal: true, // A2A is authenticated — include internal articles
      }

      let aiResponseText = ''
      let sources: unknown[] = []
      let confidence = 0.5
      let shouldEscalate = false
      let escalationReason: string | undefined

      try {
        for await (const event of runAgent(agentCtx, chatMessages)) {
          if (event.type === 'text') {
            aiResponseText += event.text
          } else if (event.type === 'done') {
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
          }
          // type === 'error' is surfaced via the catch block below since the
          // generator throws after emitting it.
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'AI agent error'
        const failedTask: A2ATask = {
          id: conversationId,
          status: {
            state: 'failed',
            message: {
              role: 'agent',
              parts: [{ type: 'text', text: errorMessage }],
            },
          },
        }
        return jsonRpcSuccess(rpc.id, failedTask)
      }

      // Persist the AI reply so it appears in the dashboard inbox and is
      // returned in subsequent tasks/get and message/send calls as history.
      if (aiResponseText) {
        await prisma.message.create({
          data: {
            conversationId,
            role: 'AI',
            content: aiResponseText,
            sources: sources.length > 0 ? (sources as never) : undefined,
            confidence,
          },
        })
      }

      const updateData: Record<string, unknown> = { aiConfidence: confidence }
      if (shouldEscalate) {
        updateData.status = 'ESCALATED'
        updateData.escalationReason = escalationReason ?? null
      }
      await prisma.conversation.update({ where: { id: conversationId }, data: updateData })

      const finalState: A2ATaskState = shouldEscalate ? 'input-required' : 'completed'
      const responseText = aiResponseText || 'No response generated.'

      const task: A2ATask = {
        id: conversationId,
        status: {
          state: finalState,
          message: {
            role: 'agent',
            parts: [{ type: 'text', text: responseText }],
          },
        },
        artifacts: aiResponseText
          ? [
              {
                parts: [
                  {
                    type: 'text' as const,
                    text: aiResponseText,
                    metadata:
                      sources.length > 0
                        ? { sources, confidence }
                        : { confidence },
                  },
                ],
                index: 0,
                lastChunk: true,
              },
            ]
          : undefined,
      }

      return jsonRpcSuccess(rpc.id, task)
    }

    // ── message/send-streaming ───────────────────────────────────────────────
    //
    // Returns a Server-Sent Events stream of A2A task update events. Each event
    // is a JSON object with a `type` field ('status' | 'artifact'). The client
    // should buffer artifact chunks (append: true) until lastChunk: true is set,
    // then consider the artifact complete.
    case 'message/send-streaming': {
      const params = rpc.params ?? {}
      const message = params.message as A2AMessage | undefined
      const taskId = params.id as string | undefined

      if (!message?.parts?.length) {
        return jsonRpcError(rpc.id, INVALID_PARAMS, 'message with parts is required')
      }

      const textPart = message.parts.find((p) => p.type === 'text')
      if (!textPart?.text?.trim()) {
        return jsonRpcError(rpc.id, INVALID_PARAMS, 'message must contain a non-empty text part')
      }

      const content = textPart.text.trim().slice(0, 2000)

      const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: {
          id: true,
          name: true,
          aiEnabled: true,
          aiProvider: true,
          aiApiKey: true,
          aiModel: true,
          aiInstructions: true,
          aiEscalationThreshold: true,
        },
      })
      if (!workspace) {
        return jsonRpcError(rpc.id, INTERNAL_ERROR, 'Workspace not found')
      }

      // Check AI credit quota — BYOK allowed for self-hosted, PRO, BUSINESS
      const creditLimit = await checkLimit(workspace.id, 'aiCredits')
      const byokAllowed = creditLimit.plan === 'SELF_HOSTED' || creditLimit.plan === 'PRO' || creditLimit.plan === 'BUSINESS'
      if (!isByok({ aiApiKey: workspace.aiApiKey }, { byok: byokAllowed })) {
        if (!creditLimit.allowed) {
          return jsonRpcError(rpc.id, INTERNAL_ERROR, 'AI credit limit reached for this month')
        }
        incrementUsage(workspace.id, 'aiCredits')
      }

      let conversationId: string

      if (taskId) {
        const existing = await prisma.conversation.findFirst({
          where: { id: taskId, workspaceId },
          select: { id: true },
        })
        if (!existing) {
          return jsonRpcError(rpc.id, TASK_NOT_FOUND, `Task ${taskId} not found`)
        }
        conversationId = existing.id
      } else {
        const created = await prisma.conversation.create({
          data: {
            workspaceId,
            subject: content.slice(0, 200),
            customerName: 'A2A Agent',
          },
          select: { id: true },
        })
        conversationId = created.id
      }

      await prisma.message.create({
        data: { conversationId, role: 'CUSTOMER', content },
      })

      // Snapshot history before entering the streaming closure; avoids an async
      // query inside the ReadableStream constructor where errors are harder to surface.
      const history = await prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
        select: { role: true, content: true },
      })

      const chatMessages: ChatMessage[] = history.map((m) => ({
        role: m.role === 'CUSTOMER' ? ('user' as const) : ('assistant' as const),
        content: m.content,
      }))

      const agentCtx = {
        workspaceId: workspace.id,
        workspaceName: workspace.name,
        conversationId,
        aiProvider: workspace.aiProvider as string | null,
        aiApiKey: workspace.aiApiKey,
        aiModel: workspace.aiModel,
        aiInstructions: workspace.aiInstructions,
        aiEscalationThreshold: workspace.aiEscalationThreshold,
        includeInternal: true, // A2A is authenticated — include internal articles
      }

      // Capture loop variables for the closure. `conversationId` is already
      // a const but we alias for clarity inside the async start() callback.
      const finalConvId = conversationId
      const aiEnabled = workspace.aiEnabled

      const encoder = new TextEncoder()

      function sseEvent(payload: Record<string, unknown>): Uint8Array {
        return encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)
      }

      const readable = new ReadableStream({
        async start(controller) {
          try {
            // Immediately notify the client that we're processing.
            controller.enqueue(
              sseEvent({
                type: 'status',
                taskId: finalConvId,
                status: { state: 'working' },
              }),
            )

            if (!aiEnabled) {
              // AI disabled — park in input-required so a human can respond.
              controller.enqueue(
                sseEvent({
                  type: 'status',
                  taskId: finalConvId,
                  status: {
                    state: 'input-required',
                    message: {
                      role: 'agent',
                      parts: [
                        {
                          type: 'text',
                          text: 'AI is not enabled for this workspace. A human agent will respond.',
                        },
                      ],
                    },
                  },
                }),
              )
              controller.close()
              return
            }

            let aiResponseText = ''
            let sources: unknown[] = []
            let confidence = 0.5
            let shouldEscalate = false
            let escalationReason: string | undefined

            for await (const event of runAgent(agentCtx, chatMessages)) {
              if (event.type === 'text') {
                aiResponseText += event.text
                // Stream each text delta as an append-mode artifact chunk so
                // clients can render partial responses progressively.
                controller.enqueue(
                  sseEvent({
                    type: 'artifact',
                    taskId: finalConvId,
                    artifact: {
                      parts: [{ type: 'text', text: event.text }],
                      index: 0,
                      append: true,
                      lastChunk: false,
                    },
                  }),
                )
              } else if (event.type === 'done') {
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
              }
            }

            // Persist the AI reply after the generator has fully completed —
            // we need the full text before creating the DB row.
            if (aiResponseText) {
              await prisma.message.create({
                data: {
                  conversationId: finalConvId,
                  role: 'AI',
                  content: aiResponseText,
                  sources: sources.length > 0 ? (sources as never) : undefined,
                  confidence,
                },
              })
            }

            const updateData: Record<string, unknown> = { aiConfidence: confidence }
            if (shouldEscalate) {
              updateData.status = 'ESCALATED'
              updateData.escalationReason = escalationReason ?? null
            }
            await prisma.conversation.update({
              where: { id: finalConvId },
              data: updateData,
            })

            // Final artifact chunk carries source metadata in its metadata field
            // rather than individual part metadata to avoid bloating each delta.
            controller.enqueue(
              sseEvent({
                type: 'artifact',
                taskId: finalConvId,
                artifact: {
                  parts: [{ type: 'text', text: '' }],
                  index: 0,
                  append: true,
                  lastChunk: true,
                  metadata:
                    sources.length > 0 ? { sources, confidence } : { confidence },
                },
              }),
            )

            const finalState: A2ATaskState = shouldEscalate ? 'input-required' : 'completed'
            controller.enqueue(
              sseEvent({
                type: 'status',
                taskId: finalConvId,
                status: {
                  state: finalState,
                  message: {
                    role: 'agent',
                    parts: [
                      {
                        type: 'text',
                        text: aiResponseText || 'No response generated.',
                      },
                    ],
                  },
                },
              }),
            )
          } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'AI agent error'
            controller.enqueue(
              sseEvent({
                type: 'status',
                taskId: finalConvId,
                status: {
                  state: 'failed',
                  message: {
                    role: 'agent',
                    parts: [{ type: 'text', text: errorMessage }],
                  },
                },
              }),
            )
          } finally {
            controller.close()
          }
        },
      })

      return new Response(readable, {
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      })
    }

    // ── tasks/get ────────────────────────────────────────────────────────────
    case 'tasks/get': {
      const taskId = rpc.params?.id as string | undefined
      if (!taskId) {
        return jsonRpcError(rpc.id, INVALID_PARAMS, 'id is required')
      }

      const task = await conversationToTask(taskId, workspaceId, true)
      if (!task) {
        return jsonRpcError(rpc.id, TASK_NOT_FOUND, `Task ${taskId} not found`)
      }

      return jsonRpcSuccess(rpc.id, task)
    }

    // ── tasks/cancel ─────────────────────────────────────────────────────────
    case 'tasks/cancel': {
      const taskId = rpc.params?.id as string | undefined
      if (!taskId) {
        return jsonRpcError(rpc.id, INVALID_PARAMS, 'id is required')
      }

      const conversation = await prisma.conversation.findFirst({
        where: { id: taskId, workspaceId },
        select: { id: true },
      })
      if (!conversation) {
        return jsonRpcError(rpc.id, TASK_NOT_FOUND, `Task ${taskId} not found`)
      }

      await prisma.conversation.update({
        where: { id: taskId },
        data: { status: 'CLOSED' },
      })

      const task: A2ATask = { id: taskId, status: { state: 'canceled' } }
      return jsonRpcSuccess(rpc.id, task)
    }

    default:
      return jsonRpcError(rpc.id, METHOD_NOT_FOUND, `Method ${rpc.method} not found`)
  }
}
