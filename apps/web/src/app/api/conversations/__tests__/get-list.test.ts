import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── hoisted mock refs ──────────────────────────────────────────────────────
// vi.mock() calls are hoisted to the top of the file by Vitest's transform,
// so any variables they reference must also be hoisted with vi.hoisted().

const { mockConversationFindMany, mockConversationCount, mockRequireAuth } = vi.hoisted(() => ({
  mockConversationFindMany: vi.fn(),
  mockConversationCount: vi.fn(),
  mockRequireAuth: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    conversation: {
      findMany: mockConversationFindMany,
      count: mockConversationCount,
    },
  },
}))

vi.mock('@/lib/auth-api', () => ({ requireAuth: mockRequireAuth }))

import { GET } from '../route'

function makeGetRequest(params: Record<string, string> = {}): Request {
  const url = new URL('http://localhost/api/conversations')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return new Request(url.toString())
}

const CONTACT = { id: 'contact-1', email: 'alice@acme.com', fullName: 'Alice' }
const ORG = { id: 'org-1', name: 'Acme Inc', plan: 'pro' }

const CONVERSATION_ROW = {
  id: 'conv-1',
  status: 'ESCALATED',
  number: 42,
  customerName: 'Alice',
  customerEmail: 'alice@acme.com',
  subject: 'Login issue',
  aiConfidence: 0.4,
  escalationReason: null,
  contact: CONTACT,
  organization: ORG,
  assignedTo: null,
  messages: [{ content: 'I cannot log in', role: 'CUSTOMER' }],
  _count: { messages: 3 },
  createdAt: new Date('2026-05-29T09:00:00Z'),
  updatedAt: new Date('2026-05-29T10:00:00Z'),
}

beforeEach(() => {
  vi.clearAllMocks()
  mockRequireAuth.mockResolvedValue({ workspaceId: 'ws-1', userId: 'user-1', via: 'session' })
  mockConversationFindMany.mockResolvedValue([CONVERSATION_ROW])
  mockConversationCount.mockResolvedValue(1)
})

describe('GET /api/conversations (list)', () => {
  it('returns 401 when unauthenticated', async () => {
    mockRequireAuth.mockResolvedValue(null)
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(401)
  })

  it('includes number in each conversation row', async () => {
    const res = await GET(makeGetRequest())
    const body = await res.json()
    expect(body.data[0].number).toBe(42)
  })

  it('includes contact with id, email, fullName in each row', async () => {
    const res = await GET(makeGetRequest())
    const body = await res.json()
    const contact = body.data[0].contact
    expect(contact).toMatchObject({ id: 'contact-1', email: 'alice@acme.com', fullName: 'Alice' })
  })

  it('includes organization with id, name, plan in each row', async () => {
    const res = await GET(makeGetRequest())
    const body = await res.json()
    const org = body.data[0].organization
    expect(org).toMatchObject({ id: 'org-1', name: 'Acme Inc', plan: 'pro' })
  })

  it('includes both contact: null and organization: null for anonymous conversations', async () => {
    mockConversationFindMany.mockResolvedValue([
      { ...CONVERSATION_ROW, contact: null, organization: null },
    ])
    const res = await GET(makeGetRequest())
    const body = await res.json()
    expect(body.data[0].contact).toBeNull()
    expect(body.data[0].organization).toBeNull()
  })

  it('queries with the correct contact and organization include clauses', async () => {
    await GET(makeGetRequest())
    expect(mockConversationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          contact: expect.objectContaining({
            select: expect.objectContaining({ id: true, email: true, fullName: true }),
          }),
          organization: expect.objectContaining({
            select: expect.objectContaining({ id: true, name: true, plan: true }),
          }),
        }),
      })
    )
  })
})
