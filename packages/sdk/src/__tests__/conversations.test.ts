import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HelpNest } from '../index'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function mockResponse(data: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: { get: () => null },
    json: () => Promise.resolve(data),
  })
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

const baseConversation = {
  id: 'conv-1',
  workspaceId: 'ws-1',
  status: 'ACTIVE' as const,
  customerName: 'Alice',
  customerEmail: 'alice@example.com',
  subject: 'Billing question',
  aiConfidence: null,
  escalationReason: null,
  resolutionSummary: null,
  messageCount: 3,
  firstMessage: 'Hello, I have a question about my invoice.',
  createdAt: '2024-01-15T10:00:00Z',
  updatedAt: '2024-01-15T10:05:00Z',
}

const baseMessage = {
  id: 'msg-1',
  conversationId: 'conv-1',
  role: 'CUSTOMER' as const,
  content: 'Hello, I have a question about my invoice.',
  confidence: null,
  feedbackHelpful: null,
  createdAt: '2024-01-15T10:00:00Z',
}

// ─── ConversationsResource ────────────────────────────────────────────────────

describe('HelpNest SDK — ConversationsResource', () => {
  let client: HelpNest

  beforeEach(() => {
    mockFetch.mockReset()
    client = new HelpNest({
      apiKey: 'test-key',
      workspace: 'test-workspace',
      baseUrl: 'http://localhost:3000',
    })
  })

  // ── list() ──────────────────────────────────────────────────────────────────

  it('list() returns paginated response with data and total', async () => {
    const data = [baseConversation]
    mockFetch.mockReturnValueOnce(mockResponse({ data, total: 1, page: 1, limit: 20 }))

    const result = await client.conversations.list()

    expect(result.data).toEqual(data)
    expect(result.total).toBe(1)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/conversations'),
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('list() with status filter appends status as query param', async () => {
    mockFetch.mockReturnValueOnce(mockResponse({ data: [], total: 0, page: 1, limit: 20 }))

    await client.conversations.list({ status: 'ESCALATED' })

    const url: string = mockFetch.mock.calls[0][0] as string
    expect(url).toContain('status=ESCALATED')
  })

  it('list() with page and limit appends pagination params', async () => {
    mockFetch.mockReturnValueOnce(mockResponse({ data: [], total: 0, page: 2, limit: 10 }))

    await client.conversations.list({ page: 2, limit: 10 })

    const url: string = mockFetch.mock.calls[0][0] as string
    expect(url).toContain('page=2')
    expect(url).toContain('limit=10')
  })

  it('list() with all params combines status and pagination', async () => {
    mockFetch.mockReturnValueOnce(mockResponse({ data: [], total: 0, page: 1, limit: 5 }))

    await client.conversations.list({ status: 'RESOLVED_AI', page: 1, limit: 5 })

    const url: string = mockFetch.mock.calls[0][0] as string
    expect(url).toContain('status=RESOLVED_AI')
    expect(url).toContain('page=1')
    expect(url).toContain('limit=5')
  })

  it('list() with no params omits optional query params', async () => {
    mockFetch.mockReturnValueOnce(mockResponse({ data: [], total: 0, page: 1, limit: 20 }))

    await client.conversations.list()

    const url: string = mockFetch.mock.calls[0][0] as string
    // workspace is always present; status/page/limit should be absent when not passed
    expect(url).not.toContain('status=')
    expect(url).not.toContain('page=')
    expect(url).not.toContain('limit=')
  })

  // ── get() ───────────────────────────────────────────────────────────────────

  it('get() returns the single conversation for a given ID', async () => {
    mockFetch.mockReturnValueOnce(mockResponse(baseConversation))

    const result = await client.conversations.get('conv-1')

    expect(result).toEqual(baseConversation)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/conversations/conv-1'),
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('get() encodes the conversation ID in the URL path', async () => {
    const conv = { ...baseConversation, id: 'conv-abc-123' }
    mockFetch.mockReturnValueOnce(mockResponse(conv))

    await client.conversations.get('conv-abc-123')

    const url: string = mockFetch.mock.calls[0][0] as string
    expect(url).toContain('/api/conversations/conv-abc-123')
  })

  // ── create() ────────────────────────────────────────────────────────────────

  it('create() sends POST to /conversations with required workspaceSlug', async () => {
    const created = { ...baseConversation, id: 'conv-new' }
    mockFetch.mockReturnValueOnce(mockResponse(created, 201))

    const result = await client.conversations.create({ workspaceSlug: 'acme' })

    expect(result).toEqual(created)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/conversations'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ workspaceSlug: 'acme' }),
      }),
    )
  })

  it('create() sends customerName and customerEmail when provided', async () => {
    const created = { ...baseConversation, customerName: 'Bob', customerEmail: 'bob@example.com' }
    mockFetch.mockReturnValueOnce(mockResponse(created, 201))

    await client.conversations.create({
      workspaceSlug: 'acme',
      customerName: 'Bob',
      customerEmail: 'bob@example.com',
    })

    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string)
    expect(body.customerName).toBe('Bob')
    expect(body.customerEmail).toBe('bob@example.com')
  })

  // ── updateStatus() ──────────────────────────────────────────────────────────

  it('updateStatus() sends PATCH with status to /conversations/:id', async () => {
    const updated = { ...baseConversation, status: 'CLOSED' as const }
    mockFetch.mockReturnValueOnce(mockResponse(updated))

    const result = await client.conversations.updateStatus('conv-1', 'CLOSED')

    expect(result.status).toBe('CLOSED')
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/conversations/conv-1'),
      expect.objectContaining({ method: 'PATCH' }),
    )
  })

  it('updateStatus() includes resolutionSummary in body when provided', async () => {
    const updated = {
      ...baseConversation,
      status: 'RESOLVED_HUMAN' as const,
      resolutionSummary: 'Issue was a billing discrepancy, refund issued.',
    }
    mockFetch.mockReturnValueOnce(mockResponse(updated))

    await client.conversations.updateStatus(
      'conv-1',
      'RESOLVED_HUMAN',
      'Issue was a billing discrepancy, refund issued.',
    )

    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string)
    expect(body.status).toBe('RESOLVED_HUMAN')
    expect(body.resolutionSummary).toBe('Issue was a billing discrepancy, refund issued.')
  })

  it('updateStatus() sends undefined resolutionSummary when omitted', async () => {
    // When no resolutionSummary is provided, the key should be undefined (serialised
    // out of JSON.stringify, so it must not appear in the request body).
    mockFetch.mockReturnValueOnce(mockResponse({ ...baseConversation, status: 'CLOSED' }))

    await client.conversations.updateStatus('conv-1', 'CLOSED')

    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string)
    expect(body).not.toHaveProperty('resolutionSummary')
  })

  // ── assign() ────────────────────────────────────────────────────────────────

  it('assign() sends POST to /conversations/:id/assign with memberId', async () => {
    const updated = { ...baseConversation, assignedTo: { name: 'Dave', email: 'dave@example.com' } }
    mockFetch.mockReturnValueOnce(mockResponse(updated))

    const result = await client.conversations.assign('conv-1', 'member-42')

    expect(result).toEqual(updated)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/conversations/conv-1/assign'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ memberId: 'member-42' }),
      }),
    )
  })

  it('assign() with null memberId sends null to unassign the conversation', async () => {
    const updated = { ...baseConversation, assignedTo: null }
    mockFetch.mockReturnValueOnce(mockResponse(updated))

    const result = await client.conversations.assign('conv-1', null)

    expect(result.assignedTo).toBeNull()
    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string)
    expect(body.memberId).toBeNull()
  })

  // ── error handling ───────────────────────────────────────────────────────────

  it('throws HelpNestError on 404 with the API error message', async () => {
    mockFetch.mockReturnValueOnce(mockResponse({ error: 'Conversation not found' }, 404))

    const { HelpNestError } = await import('../index')
    const err = await client.conversations.get('nonexistent').catch((e) => e)

    expect(err).toBeInstanceOf(HelpNestError)
    expect(err.statusCode).toBe(404)
    expect(err.message).toContain('Conversation not found')
  })

  it('throws HelpNestError on 401 when API key is invalid', async () => {
    mockFetch.mockReturnValueOnce(mockResponse({ error: 'Unauthorized' }, 401))

    const { HelpNestError } = await import('../index')
    const err = await client.conversations.list().catch((e) => e)

    expect(err).toBeInstanceOf(HelpNestError)
    expect(err.statusCode).toBe(401)
  })

  it('sends Authorization and workspace headers on every request', async () => {
    mockFetch.mockReturnValueOnce(mockResponse({ data: [], total: 0, page: 1, limit: 20 }))

    await client.conversations.list()

    expect(mockFetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-key',
          'X-HelpNest-Workspace': 'test-workspace',
        }),
      }),
    )
  })
})

// ─── MessagesResource ─────────────────────────────────────────────────────────

describe('HelpNest SDK — MessagesResource', () => {
  let client: HelpNest

  beforeEach(() => {
    mockFetch.mockReset()
    client = new HelpNest({
      apiKey: 'test-key',
      workspace: 'test-workspace',
      baseUrl: 'http://localhost:3000',
    })
  })

  // ── list() ──────────────────────────────────────────────────────────────────

  it('list() returns messages array for a conversation', async () => {
    const messages = [baseMessage]
    mockFetch.mockReturnValueOnce(mockResponse({ messages }))

    const result = await client.messages.list('conv-1')

    expect(result.messages).toEqual(messages)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/conversations/conv-1/messages'),
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('list() returns empty array when conversation has no messages', async () => {
    mockFetch.mockReturnValueOnce(mockResponse({ messages: [] }))

    const result = await client.messages.list('conv-empty')

    expect(result.messages).toHaveLength(0)
  })

  it('list() with since parameter appends encoded timestamp to the URL', async () => {
    mockFetch.mockReturnValueOnce(mockResponse({ messages: [] }))

    await client.messages.list('conv-1', '2024-01-15T10:00:00Z')

    const url: string = mockFetch.mock.calls[0][0] as string
    // The since value must be present in the URL (percent-encoded or raw)
    expect(url).toContain('since=')
    expect(decodeURIComponent(url)).toContain('since=2024-01-15T10:00:00Z')
  })

  it('list() without since does not add a since param', async () => {
    mockFetch.mockReturnValueOnce(mockResponse({ messages: [] }))

    await client.messages.list('conv-1')

    const url: string = mockFetch.mock.calls[0][0] as string
    expect(url).not.toContain('since=')
  })

  it('list() includes multiple message roles (CUSTOMER, AI, AGENT)', async () => {
    const messages = [
      { ...baseMessage, id: 'msg-1', role: 'CUSTOMER' as const },
      { ...baseMessage, id: 'msg-2', role: 'AI' as const },
      { ...baseMessage, id: 'msg-3', role: 'AGENT' as const },
    ]
    mockFetch.mockReturnValueOnce(mockResponse({ messages }))

    const result = await client.messages.list('conv-1')

    expect(result.messages).toHaveLength(3)
    expect(result.messages[0].role).toBe('CUSTOMER')
    expect(result.messages[1].role).toBe('AI')
    expect(result.messages[2].role).toBe('AGENT')
  })

  // ── send() ──────────────────────────────────────────────────────────────────

  it('send() posts a message and returns the created message object', async () => {
    const message = { ...baseMessage, id: 'msg-new', content: 'Can you help me?' }
    mockFetch.mockReturnValueOnce(mockResponse({ message }))

    const result = await client.messages.send('conv-1', { content: 'Can you help me?' })

    expect(result.message).toEqual(message)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/conversations/conv-1/messages'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ content: 'Can you help me?' }),
      }),
    )
  })

  it('send() targets the correct conversation ID in the URL path', async () => {
    const message = { ...baseMessage, conversationId: 'conv-xyz' }
    mockFetch.mockReturnValueOnce(mockResponse({ message }))

    await client.messages.send('conv-xyz', { content: 'Hello' })

    const url: string = mockFetch.mock.calls[0][0] as string
    expect(url).toContain('/api/conversations/conv-xyz/messages')
  })

  // ── error handling ───────────────────────────────────────────────────────────

  it('throws HelpNestError on 404 when conversation does not exist', async () => {
    mockFetch.mockReturnValueOnce(mockResponse({ error: 'Conversation not found' }, 404))

    const { HelpNestError } = await import('../index')
    const err = await client.messages.list('no-such-conv').catch((e) => e)

    expect(err).toBeInstanceOf(HelpNestError)
    expect(err.statusCode).toBe(404)
  })

  it('throws HelpNestError on 403 when sending to a closed conversation', async () => {
    mockFetch.mockReturnValueOnce(mockResponse({ error: 'Conversation is closed' }, 403))

    const { HelpNestError } = await import('../index')
    const err = await client.messages
      .send('conv-closed', { content: 'Too late' })
      .catch((e) => e)

    expect(err).toBeInstanceOf(HelpNestError)
    expect(err.statusCode).toBe(403)
    expect(err.message).toContain('Conversation is closed')
  })

  it('sends Authorization and workspace headers when listing messages', async () => {
    mockFetch.mockReturnValueOnce(mockResponse({ messages: [] }))

    await client.messages.list('conv-1')

    expect(mockFetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-key',
          'X-HelpNest-Workspace': 'test-workspace',
        }),
      }),
    )
  })
})
