import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST, GET } from '../route'

// ── mocks ──────────────────────────────────────────────────────────────────
// vi.mock factories are hoisted to the top of the file before any const
// declarations. The vi.hoisted() helper lets us create the mock fns before
// hoisting so factories can safely reference them.

const {
  mockConversationFindFirst,
  mockConversationUpdate,
  mockMessageCreate,
  mockMessageFindMany,
  mockMessageCount,
  mockMemberFindFirst,
  mockRequireAuth,
  mockEmitConversationEvent,
} = vi.hoisted(() => ({
  mockConversationFindFirst: vi.fn(),
  mockConversationUpdate: vi.fn(),
  mockMessageCreate: vi.fn(),
  mockMessageFindMany: vi.fn(),
  mockMessageCount: vi.fn(),
  mockMemberFindFirst: vi.fn(),
  mockRequireAuth: vi.fn(),
  mockEmitConversationEvent: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    conversation: {
      findFirst: mockConversationFindFirst,
      update: mockConversationUpdate,
    },
    message: {
      create: mockMessageCreate,
      findMany: mockMessageFindMany,
      count: mockMessageCount,
    },
    member: {
      findFirst: mockMemberFindFirst,
    },
  },
}))

vi.mock('@/lib/auth-api', () => ({ requireAuth: mockRequireAuth }))

vi.mock('@/lib/cloud', () => ({
  checkLimit: vi.fn().mockResolvedValue({ allowed: true, plan: 'SELF_HOSTED' }),
  incrementUsage: vi.fn(),
}))

vi.mock('@/lib/ai/resolve-provider', () => ({ isByok: vi.fn().mockReturnValue(true) }))
vi.mock('@/lib/redis', () => ({ redis: null }))
vi.mock('@/lib/ai-agent', () => ({ runAgent: vi.fn(), recordKnowledgeGap: vi.fn() }))
vi.mock('@/lib/article-drafter', () => ({ draftArticle: vi.fn() }))

vi.mock('@/lib/conversation-events', () => ({
  emitConversationEvent: mockEmitConversationEvent,
}))

// ── helpers ────────────────────────────────────────────────────────────────

function makePostRequest(body: Record<string, unknown>, authHeader?: string): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (authHeader) headers['Authorization'] = authHeader
  return new Request('http://localhost/api/conversations/conv-1/messages', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
}

function makeGetRequest(opts: { sessionToken?: string; visitorId?: string } = {}): Request {
  const headers: Record<string, string> = {}
  if (opts.sessionToken) headers['X-Session-Token'] = opts.sessionToken
  if (opts.visitorId) headers['X-Visitor-Id'] = opts.visitorId
  return new Request('http://localhost/api/conversations/conv-1/messages', { headers })
}

const PARAMS = Promise.resolve({ id: 'conv-1' })

// Base agent conversation (no sessionToken branch)
const AGENT_CONVERSATION = {
  id: 'conv-1',
  workspaceId: 'ws-1',
  status: 'ESCALATED',
  createdAt: new Date('2026-05-29T09:00:00Z'),
}

beforeEach(() => {
  vi.clearAllMocks()
  mockRequireAuth.mockResolvedValue({ workspaceId: 'ws-1', userId: 'user-1', via: 'session' })
  mockConversationFindFirst.mockResolvedValue(AGENT_CONVERSATION)
  mockConversationUpdate.mockResolvedValue({ ...AGENT_CONVERSATION, status: 'HUMAN_ACTIVE' })
  mockMessageCreate.mockResolvedValue({
    id: 'msg-1',
    content: 'hello',
    role: 'AGENT',
    isInternal: false,
  })
  mockMessageFindMany.mockResolvedValue([])
  mockMessageCount.mockResolvedValue(0)
  mockEmitConversationEvent.mockResolvedValue(undefined)
  mockMemberFindFirst.mockResolvedValue({
    id: 'member-1',
    user: { name: 'Test Agent', email: 'agent@test.com' },
  })
})

// ── POST tests ─────────────────────────────────────────────────────────────

describe('POST /api/conversations/[id]/messages', () => {
  describe('agent flow — isInternal', () => {
    it('saves an internal note for AGENT role and does NOT transition to HUMAN_ACTIVE', async () => {
      mockMessageCreate.mockResolvedValue({
        id: 'msg-2',
        content: 'private note',
        role: 'AGENT',
        isInternal: true,
      })

      const res = await POST(makePostRequest({ content: 'private note', isInternal: true }), {
        params: PARAMS,
      })
      expect(res.status).toBe(200)

      // message.create called with isInternal: true
      expect(mockMessageCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isInternal: true }) })
      )

      // conversation.update should NOT have been called (no HUMAN_ACTIVE transition)
      expect(mockConversationUpdate).not.toHaveBeenCalled()
    })

    it('emits NOTE_ADDED for an internal note', async () => {
      mockMessageCreate.mockResolvedValue({
        id: 'msg-2',
        content: 'note',
        role: 'AGENT',
        isInternal: true,
      })

      await POST(makePostRequest({ content: 'note', isInternal: true }), { params: PARAMS })

      expect(mockEmitConversationEvent).toHaveBeenCalledWith(
        expect.objectContaining({ verb: 'NOTE_ADDED' })
      )
    })

    it('transitions to HUMAN_ACTIVE on a public AGENT reply (existing behaviour preserved)', async () => {
      const res = await POST(
        makePostRequest({ content: 'Hello, let me help.', isInternal: false }),
        { params: PARAMS }
      )
      expect(res.status).toBe(200)

      expect(mockConversationUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'HUMAN_ACTIVE' }) })
      )
    })

    it('returns 400 when isInternal is true but role is CUSTOMER (widget path blocked)', async () => {
      // Simulate widget/customer trying to send an internal note.
      // Widget path uses session token — this test uses a session token header.
      mockConversationFindFirst.mockResolvedValue({
        ...AGENT_CONVERSATION,
        sessionToken: 'tok-abc',
        workspace: {
          name: 'Acme',
          aiEnabled: false,
          aiProvider: null,
          aiApiKey: null,
          aiModel: null,
          aiInstructions: null,
          aiEscalationThreshold: 0.3,
          autoDraftGapsEnabled: false,
          autoDraftGapThreshold: 2,
        },
      })

      // The POST handler for the widget/session-token path does not support isInternal.
      // Passing isInternal=true from a customer session must return 400.
      const reqWithSessionToken = new Request(
        'http://localhost/api/conversations/conv-1/messages',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Session-Token': 'tok-abc' },
          body: JSON.stringify({ content: 'try internal', isInternal: true }),
        }
      )

      const res = await POST(reqWithSessionToken, { params: PARAMS })
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/internal notes.*customer|not allowed/i)
    })

    it('sets authorMemberId on agent messages', async () => {
      // requireAuth returns userId; handler must resolve memberId and set authorMemberId.
      await POST(makePostRequest({ content: 'Reply from agent.' }), { params: PARAMS })

      expect(mockMessageCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ authorMemberId: expect.any(String) }),
        })
      )
    })

    it('emits FIRST_RESPONSE_SENT with durationSeconds for the first non-internal agent message', async () => {
      // Message count = 0 means this is the first agent message.
      mockMessageCount.mockResolvedValue(0)

      await POST(makePostRequest({ content: 'First reply!' }), { params: PARAMS })

      expect(mockEmitConversationEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          verb: 'FIRST_RESPONSE_SENT',
          durationSeconds: expect.any(Number),
        })
      )
    })
  })
})

// ── GET tests ──────────────────────────────────────────────────────────────

describe('GET /api/conversations/[id]/messages', () => {
  it('widget path (sessionToken) sets isInternal:false on the messageWhere clause', async () => {
    mockConversationFindFirst.mockResolvedValue({ id: 'conv-1' })

    await GET(makeGetRequest({ sessionToken: 'tok-abc' }), { params: PARAMS })

    expect(mockMessageFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isInternal: false }),
      })
    )
  })

  it('widget path (visitorId) sets isInternal:false on the messageWhere clause', async () => {
    mockConversationFindFirst.mockResolvedValue({ id: 'conv-1' })

    await GET(makeGetRequest({ visitorId: 'visitor-xyz' }), { params: PARAMS })

    expect(mockMessageFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isInternal: false }),
      })
    )
  })

  it('dashboard path does NOT set isInternal on the messageWhere clause', async () => {
    mockConversationFindFirst.mockResolvedValue({ id: 'conv-1' })

    await GET(makeGetRequest(), { params: PARAMS }) // no session token, triggers requireAuth path

    const call = mockMessageFindMany.mock.calls[0][0]
    expect(call.where).not.toHaveProperty('isInternal')
  })
})
