/**
 * The escalation reason is written for the SUPPORT TEAM, not the customer.
 *
 * "Answer not grounded in the knowledge base (confidence 0.00, best vector match
 * 0.19)" is exactly what an agent tuning the gate needs, and exactly what a
 * customer should never see: it is meaningless to them, it reads as a malfunction,
 * and it exposes retrieval internals to anyone who can open a chat widget.
 *
 * The two audiences get different text:
 *   - customer  -> a plain notice that a human is taking over. No numbers.
 *   - support   -> the full diagnostic, on Conversation.escalationReason and in
 *                  the message's grounding breakdown.
 */

import { vi, beforeEach, describe, it, expect } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    conversation: { findFirst: vi.fn(), update: vi.fn() },
    message: { findMany: vi.fn(), create: vi.fn(), count: vi.fn() },
    workspace: { findFirst: vi.fn() },
  },
}))
vi.mock('@/lib/auth-api', () => ({ requireAuth: vi.fn() }))
vi.mock('@/lib/ai/resolve-provider', () => ({ isByok: vi.fn(() => false) }))
vi.mock('@/lib/cloud', () => ({
  checkLimit: vi.fn(async () => ({ allowed: true, plan: 'SELF_HOSTED' })),
  incrementUsage: vi.fn(),
}))
vi.mock('@/lib/redis', () => ({ redis: null }))
vi.mock('@/lib/article-drafter', () => ({ draftArticle: vi.fn() }))
vi.mock('@/lib/conversation-events', () => ({ emitConversationEvent: vi.fn() }))

/** The internal diagnostic the agent produces. Rich on purpose. */
const TECHNICAL_REASON =
  'Answer not grounded in the knowledge base (confidence 0.00, best vector match 0.19): ' +
  'The search returned no relevant articles about refund policy.'

vi.mock('@/lib/ai-agent', () => ({
  recordKnowledgeGap: vi.fn(async () => null),
  runAgent: vi.fn(async function* () {
    yield { type: 'text', text: 'I could not find that.' }
    yield {
      type: 'done',
      sources: [],
      confidence: 0,
      reportedConfidence: 0,
      retrievalMode: 'vector',
      retrievalScore: 0.19,
      retrievalDegraded: false,
      shouldEscalate: true,
      escalationReason: TECHNICAL_REASON,
    }
  }),
}))

import { POST } from '../conversations/[id]/messages/route'
import { prisma } from '@/lib/db'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(prisma.conversation.findFirst).mockResolvedValue({
    id: 'conv_1',
    status: 'ACTIVE',
    subject: 'Refunds',
    workspaceId: 'ws_1',
    workspace: {
      name: 'Acme',
      aiEnabled: true,
      aiProvider: null,
      aiApiKey: null,
      aiModel: null,
      aiInstructions: null,
      aiEscalationThreshold: 0.3,
      aiGroundingEnabled: true,
      aiRetrievalFloor: null,
      aiLexicalFloor: null,
      autoDraftGapsEnabled: false,
      autoDraftGapThreshold: 2,
    },
  } as never)
  vi.mocked(prisma.message.create).mockResolvedValue({ id: 'msg_1' } as never)
  vi.mocked(prisma.message.findMany).mockResolvedValue([] as never)
  vi.mocked(prisma.message.count).mockResolvedValue(1 as never)
  vi.mocked(prisma.conversation.update).mockResolvedValue({} as never)
})

/** Drives the widget POST and drains the SSE stream. */
async function sendCustomerMessage(): Promise<string> {
  const request = new Request('http://localhost/api/conversations/conv_1/messages', {
    method: 'POST',
    headers: { 'x-session-token': 'tok_abc', 'content-type': 'application/json' },
    body: JSON.stringify({ content: 'What is your refund policy?' }),
  })

  const response = await POST(request, { params: Promise.resolve({ id: 'conv_1' }) })
  return await response.text()
}

/** The SYSTEM message is rendered in the customer's chat widget. */
function systemMessageContent(): string {
  const call = vi
    .mocked(prisma.message.create)
    .mock.calls.find((c) => (c[0] as { data: { role: string } }).data.role === 'SYSTEM')
  return call ? (call[0] as { data: { content: string } }).data.content : ''
}

describe('escalation — what the customer is shown', () => {
  it('tells the customer a human is taking over, without any diagnostics', async () => {
    await sendCustomerMessage()
    const shown = systemMessageContent()

    expect(shown).not.toBe('')
    expect(shown.toLowerCase()).toContain('human support')
    // No retrieval internals, no scores, no jargon.
    expect(shown).not.toMatch(/vector|cosine|grounded|confidence|retrieval/i)
    expect(shown).not.toMatch(/\d/)
  })

  it('does not stream the internal reason to the widget', async () => {
    // The SSE payload lands in the customer's browser. Anything put here is public.
    const stream = await sendCustomerMessage()

    expect(stream).not.toContain('vector match')
    expect(stream).not.toContain('not grounded')
    expect(stream).toContain('"shouldEscalate":true')
  })
})

describe('escalation — what the support team keeps', () => {
  it('stores the full technical reason on the conversation', async () => {
    await sendCustomerMessage()

    const update = vi.mocked(prisma.conversation.update).mock.calls[0]?.[0] as {
      data: { status?: string; escalationReason?: string }
    }
    expect(update.data.status).toBe('ESCALATED')
    expect(update.data.escalationReason).toBe(TECHNICAL_REASON)
    expect(update.data.escalationReason).toContain('best vector match 0.19')
  })
})
