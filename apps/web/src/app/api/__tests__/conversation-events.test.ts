import { vi, beforeEach, describe, it, expect } from 'vitest'

// ---------------------------------------------------------------------------
// Module mocks — declared before any imports
// ---------------------------------------------------------------------------

vi.mock('@/lib/db', () => ({
  prisma: {
    conversation: {
      findFirst: vi.fn(),
    },
    conversationEvent: {
      findMany: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth-api', () => ({ requireAuth: vi.fn() }))

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { GET } from '@/app/api/conversations/[id]/events/route'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth-api'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(url: string): Request {
  return new Request(url, { method: 'GET' })
}

const WORKSPACE_ID = 'ws_test_001'
const CONVERSATION_ID = 'conv_test_001'

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/conversations/[id]/events', () => {
  it('returns 401 when unauthenticated', async () => {
    vi.mocked(requireAuth).mockResolvedValue(null)
    const req = makeRequest(`http://localhost/api/conversations/${CONVERSATION_ID}/events`)
    const res = await GET(req, { params: Promise.resolve({ id: CONVERSATION_ID }) })
    expect(res.status).toBe(401)
  })

  it('returns 404 when conversation does not belong to workspace', async () => {
    vi.mocked(requireAuth).mockResolvedValue({ workspaceId: WORKSPACE_ID, via: 'session' })
    vi.mocked(prisma.conversation.findFirst).mockResolvedValue(null)

    const req = makeRequest(`http://localhost/api/conversations/wrong_conv/events`)
    const res = await GET(req, { params: Promise.resolve({ id: 'wrong_conv' }) })
    expect(res.status).toBe(404)
    // Verify the workspace scope was applied to the lookup
    expect(prisma.conversation.findFirst).toHaveBeenCalledWith({
      where: { id: 'wrong_conv', workspaceId: WORKSPACE_ID },
      select: { id: true },
    })
  })

  it('returns ordered events for authenticated workspace member', async () => {
    vi.mocked(requireAuth).mockResolvedValue({ workspaceId: WORKSPACE_ID, via: 'session' })
    vi.mocked(prisma.conversation.findFirst).mockResolvedValue({ id: CONVERSATION_ID } as never)

    const events = [
      {
        id: 'evt_001',
        workspaceId: WORKSPACE_ID,
        conversationId: CONVERSATION_ID,
        actorType: 'SYSTEM',
        actorMemberId: null,
        actorLabel: 'System',
        verb: 'CONVERSATION_CREATED',
        payload: null,
        durationSeconds: null,
        durationBusinessSeconds: null,
        createdAt: new Date('2026-05-29T10:00:00Z'),
        actorMember: null,
      },
      {
        id: 'evt_002',
        workspaceId: WORKSPACE_ID,
        conversationId: CONVERSATION_ID,
        actorType: 'AGENT',
        actorMemberId: 'mem_001',
        actorLabel: 'Alice',
        verb: 'ASSIGNED',
        payload: { toMemberId: 'mem_001', toMemberName: 'Alice' },
        durationSeconds: null,
        durationBusinessSeconds: null,
        createdAt: new Date('2026-05-29T10:05:00Z'),
        actorMember: { id: 'mem_001', user: { name: 'Alice', email: 'alice@acme.com' } },
      },
    ]

    vi.mocked(prisma.conversationEvent.findMany).mockResolvedValue(events as never)

    const req = makeRequest(`http://localhost/api/conversations/${CONVERSATION_ID}/events`)
    const res = await GET(req, { params: Promise.resolve({ id: CONVERSATION_ID }) })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(2)
    expect(body.data[0].verb).toBe('CONVERSATION_CREATED')
    expect(body.data[1].verb).toBe('ASSIGNED')
    // Verify findMany was called with correct workspace+conversation scope and order
    expect(prisma.conversationEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          conversationId: CONVERSATION_ID,
          workspaceId: WORKSPACE_ID,
        }),
        orderBy: { createdAt: 'asc' },
      })
    )
  })

  it('filters events by ?since ISO timestamp', async () => {
    vi.mocked(requireAuth).mockResolvedValue({ workspaceId: WORKSPACE_ID, via: 'session' })
    vi.mocked(prisma.conversation.findFirst).mockResolvedValue({ id: CONVERSATION_ID } as never)
    vi.mocked(prisma.conversationEvent.findMany).mockResolvedValue([])

    const since = '2026-05-29T10:03:00.000Z'
    const req = makeRequest(
      `http://localhost/api/conversations/${CONVERSATION_ID}/events?since=${encodeURIComponent(since)}`
    )
    const res = await GET(req, { params: Promise.resolve({ id: CONVERSATION_ID }) })

    expect(res.status).toBe(200)
    expect(prisma.conversationEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: { gt: new Date(since) },
        }),
      })
    )
  })

  it('caps ?limit at 200', async () => {
    vi.mocked(requireAuth).mockResolvedValue({ workspaceId: WORKSPACE_ID, via: 'session' })
    vi.mocked(prisma.conversation.findFirst).mockResolvedValue({ id: CONVERSATION_ID } as never)
    vi.mocked(prisma.conversationEvent.findMany).mockResolvedValue([])

    const req = makeRequest(
      `http://localhost/api/conversations/${CONVERSATION_ID}/events?limit=9999`
    )
    const res = await GET(req, { params: Promise.resolve({ id: CONVERSATION_ID }) })

    expect(res.status).toBe(200)
    expect(prisma.conversationEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 200 })
    )
  })

  it('uses default limit of 50 when not specified', async () => {
    vi.mocked(requireAuth).mockResolvedValue({ workspaceId: WORKSPACE_ID, via: 'session' })
    vi.mocked(prisma.conversation.findFirst).mockResolvedValue({ id: CONVERSATION_ID } as never)
    vi.mocked(prisma.conversationEvent.findMany).mockResolvedValue([])

    const req = makeRequest(`http://localhost/api/conversations/${CONVERSATION_ID}/events`)
    await GET(req, { params: Promise.resolve({ id: CONVERSATION_ID }) })

    expect(prisma.conversationEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50 })
    )
  })

  it('returns 400 for invalid ?since value', async () => {
    vi.mocked(requireAuth).mockResolvedValue({ workspaceId: WORKSPACE_ID, via: 'session' })
    vi.mocked(prisma.conversation.findFirst).mockResolvedValue({ id: CONVERSATION_ID } as never)

    const req = makeRequest(
      `http://localhost/api/conversations/${CONVERSATION_ID}/events?since=not-a-date`
    )
    const res = await GET(req, { params: Promise.resolve({ id: CONVERSATION_ID }) })

    expect(res.status).toBe(400)
  })
})
