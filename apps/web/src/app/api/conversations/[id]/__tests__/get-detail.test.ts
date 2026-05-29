import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── hoisted mock refs ──────────────────────────────────────────────────────

const { mockConversationFindFirst, mockRequireAuth } = vi.hoisted(() => ({
  mockConversationFindFirst: vi.fn(),
  mockRequireAuth: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    conversation: { findFirst: mockConversationFindFirst },
  },
}))

vi.mock('@/lib/auth-api', () => ({ requireAuth: mockRequireAuth }))

import { GET } from '../route'

function makeGetRequest(): Request {
  return new Request('http://localhost/api/conversations/conv-1')
}

const PARAMS = Promise.resolve({ id: 'conv-1' })

const FULL_CONTACT = {
  id: 'contact-1',
  email: 'alice@acme.com',
  fullName: 'Alice',
  phone: null,
  avatarUrl: null,
  organizations: [{ organization: { id: 'org-1', name: 'Acme Inc', plan: 'pro' } }],
}

const FULL_CONVERSATION = {
  id: 'conv-1',
  workspaceId: 'ws-1',
  status: 'ESCALATED',
  number: 42,
  contact: FULL_CONTACT,
  organization: { id: 'org-1', name: 'Acme Inc', plan: 'pro' },
  messages: [],
  assignedTo: null,
  articles: [],
  events: [
    {
      id: 'ev-1',
      verb: 'CONVERSATION_CREATED',
      actorType: 'CUSTOMER',
      actorLabel: 'Alice',
      payload: {},
      createdAt: new Date('2026-05-29T09:00:00Z'),
    },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
  mockRequireAuth.mockResolvedValue({ workspaceId: 'ws-1', userId: 'user-1', via: 'session' })
  mockConversationFindFirst.mockResolvedValue(FULL_CONVERSATION)
})

describe('GET /api/conversations/[id] (detail)', () => {
  it('returns 401 when unauthenticated', async () => {
    mockRequireAuth.mockResolvedValue(null)
    const res = await GET(makeGetRequest(), { params: PARAMS })
    expect(res.status).toBe(401)
  })

  it('returns 404 when conversation does not exist in the workspace', async () => {
    mockConversationFindFirst.mockResolvedValue(null)
    const res = await GET(makeGetRequest(), { params: PARAMS })
    expect(res.status).toBe(404)
  })

  it('includes number in the response', async () => {
    const res = await GET(makeGetRequest(), { params: PARAMS })
    const body = await res.json()
    expect(body.number).toBe(42)
  })

  it('includes full contact with organizations in the response', async () => {
    const res = await GET(makeGetRequest(), { params: PARAMS })
    const body = await res.json()
    expect(body.contact).toMatchObject({
      id: 'contact-1',
      email: 'alice@acme.com',
      fullName: 'Alice',
    })
    expect(body.contact.organizations).toBeDefined()
  })

  it('includes organization with id, name, plan', async () => {
    const res = await GET(makeGetRequest(), { params: PARAMS })
    const body = await res.json()
    expect(body.organization).toMatchObject({ id: 'org-1', name: 'Acme Inc', plan: 'pro' })
  })

  it('includes events ordered descending, up to 20', async () => {
    const res = await GET(makeGetRequest(), { params: PARAMS })
    const body = await res.json()
    expect(Array.isArray(body.events)).toBe(true)
    expect(body.events.length).toBeLessThanOrEqual(20)
  })

  it('queries events with orderBy createdAt desc and take 20', async () => {
    await GET(makeGetRequest(), { params: PARAMS })
    expect(mockConversationFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          events: expect.objectContaining({
            orderBy: { createdAt: 'desc' },
            take: 20,
          }),
        }),
      })
    )
  })
})
