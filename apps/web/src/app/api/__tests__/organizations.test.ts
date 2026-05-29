import { vi, beforeEach, describe, it, expect } from 'vitest'

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/db', () => ({
  prisma: {
    organization: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    contactOrganization: {
      count: vi.fn(),
    },
    conversation: {
      count: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/auth-api', () => ({ requireAuth: vi.fn() }))

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { GET, POST } from '@/app/api/organizations/route'
import { GET as GET_ONE, PATCH, DELETE } from '@/app/api/organizations/[id]/route'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth-api'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(method: string, url: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

const WORKSPACE_ID = 'ws_test_001'
const ORG_ID = 'org_test_001'

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// POST /api/organizations — creates with domains
// ---------------------------------------------------------------------------

describe('POST /api/organizations', () => {
  it('returns 401 when unauthenticated', async () => {
    vi.mocked(requireAuth).mockResolvedValue(null)
    const req = makeRequest('POST', 'http://localhost/api/organizations', { name: 'Acme' })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('creates organization with domains, plan, tags', async () => {
    vi.mocked(requireAuth).mockResolvedValue({ workspaceId: WORKSPACE_ID, via: 'session' })

    const created = {
      id: ORG_ID,
      workspaceId: WORKSPACE_ID,
      name: 'Acme Corp',
      domains: ['acme.com', 'acme.io'],
      plan: 'enterprise',
      tags: ['vip', 'b2b'],
      notes: null,
      ownerId: null,
      externalId: null,
      customFields: {},
      createdAt: new Date('2026-05-29T00:00:00Z'),
      updatedAt: new Date('2026-05-29T00:00:00Z'),
      owner: null,
      _count: { contacts: 0, conversations: 0 },
    }

    vi.mocked(prisma.organization.create).mockResolvedValue(created as never)

    const req = makeRequest('POST', 'http://localhost/api/organizations', {
      name: 'Acme Corp',
      domains: ['acme.com', 'acme.io'],
      plan: 'enterprise',
      tags: ['vip', 'b2b'],
    })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.id).toBe(ORG_ID)
    expect(body.domains).toEqual(['acme.com', 'acme.io'])
    expect(body.tags).toEqual(['vip', 'b2b'])
  })

  it('returns 400 when name is missing', async () => {
    vi.mocked(requireAuth).mockResolvedValue({ workspaceId: WORKSPACE_ID, via: 'session' })
    const req = makeRequest('POST', 'http://localhost/api/organizations', { domains: ['acme.com'] })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})

// ---------------------------------------------------------------------------
// GET /api/organizations — returns contactCount + conversationCount
// ---------------------------------------------------------------------------

describe('GET /api/organizations', () => {
  it('returns paginated results with owner and counts', async () => {
    vi.mocked(requireAuth).mockResolvedValue({ workspaceId: WORKSPACE_ID, via: 'session' })

    const orgs = [
      {
        id: ORG_ID,
        workspaceId: WORKSPACE_ID,
        name: 'Acme Corp',
        domains: ['acme.com'],
        plan: 'pro',
        tags: [],
        notes: null,
        ownerId: 'mem_001',
        externalId: null,
        customFields: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        owner: { id: 'mem_001', user: { name: 'Bob', email: 'bob@helpnest.cloud' } },
        _count: { contacts: 5, conversations: 12 },
      },
    ]

    vi.mocked(prisma.organization.findMany).mockResolvedValue(orgs as never)
    vi.mocked(prisma.organization.count).mockResolvedValue(1)

    const req = makeRequest('GET', 'http://localhost/api/organizations?page=1&limit=20')
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.total).toBe(1)
    expect(body.data[0].contactCount).toBe(5)
    expect(body.data[0].conversationCount).toBe(12)
    expect(body.data[0].owner.name).toBe('Bob')
    expect(body.data[0].owner.email).toBe('bob@helpnest.cloud')
  })
})

// ---------------------------------------------------------------------------
// GET /api/organizations/[id] — single org detail
// ---------------------------------------------------------------------------

describe('GET /api/organizations/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    vi.mocked(requireAuth).mockResolvedValue(null)
    const req = makeRequest('GET', `http://localhost/api/organizations/${ORG_ID}`)
    const res = await GET_ONE(req, { params: Promise.resolve({ id: ORG_ID }) })
    expect(res.status).toBe(401)
  })

  it('returns 404 when org not found', async () => {
    vi.mocked(requireAuth).mockResolvedValue({ workspaceId: WORKSPACE_ID, via: 'session' })
    vi.mocked(prisma.organization.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.conversation.count).mockResolvedValue(0)

    const req = makeRequest('GET', `http://localhost/api/organizations/missing_id`)
    const res = await GET_ONE(req, { params: Promise.resolve({ id: 'missing_id' }) })
    expect(res.status).toBe(404)
  })

  it('returns org with openConversationCount', async () => {
    vi.mocked(requireAuth).mockResolvedValue({ workspaceId: WORKSPACE_ID, via: 'session' })

    const org = {
      id: ORG_ID,
      workspaceId: WORKSPACE_ID,
      name: 'Acme Corp',
      domains: ['acme.com'],
      plan: 'pro',
      tags: [],
      notes: null,
      ownerId: null,
      externalId: null,
      customFields: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      owner: null,
      contacts: [],
      _count: { contacts: 3, conversations: 7 },
    }

    vi.mocked(prisma.organization.findFirst).mockResolvedValue(org as never)
    vi.mocked(prisma.conversation.count).mockResolvedValue(2)

    const req = makeRequest('GET', `http://localhost/api/organizations/${ORG_ID}`)
    const res = await GET_ONE(req, { params: Promise.resolve({ id: ORG_ID }) })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.id).toBe(ORG_ID)
    expect(body.openConversationCount).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// PATCH /api/organizations/[id] — updates ownerId
// ---------------------------------------------------------------------------

describe('PATCH /api/organizations/[id]', () => {
  it('updates ownerId', async () => {
    vi.mocked(requireAuth).mockResolvedValue({ workspaceId: WORKSPACE_ID, via: 'session' })

    const existing = {
      id: ORG_ID,
      workspaceId: WORKSPACE_ID,
      name: 'Acme',
      domains: [],
      ownerId: null,
    }
    const updated = {
      ...existing,
      ownerId: 'mem_002',
      owner: { id: 'mem_002', user: { name: 'Carol', email: 'carol@helpnest.cloud' } },
      updatedAt: new Date(),
    }

    vi.mocked(prisma.organization.findFirst).mockResolvedValue(existing as never)
    vi.mocked(prisma.organization.update).mockResolvedValue(updated as never)

    const req = makeRequest('PATCH', `http://localhost/api/organizations/${ORG_ID}`, {
      ownerId: 'mem_002',
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: ORG_ID }) })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ownerId).toBe('mem_002')
  })

  it('returns 404 for org in another workspace', async () => {
    vi.mocked(requireAuth).mockResolvedValue({ workspaceId: WORKSPACE_ID, via: 'session' })
    vi.mocked(prisma.organization.findFirst).mockResolvedValue(null)

    const req = makeRequest('PATCH', `http://localhost/api/organizations/other_id`, { name: 'X' })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'other_id' }) })
    expect(res.status).toBe(404)
  })

  it('returns 400 when no valid fields to update', async () => {
    vi.mocked(requireAuth).mockResolvedValue({ workspaceId: WORKSPACE_ID, via: 'session' })

    const existing = {
      id: ORG_ID,
      workspaceId: WORKSPACE_ID,
      name: 'Acme',
      domains: [],
      ownerId: null,
    }
    vi.mocked(prisma.organization.findFirst).mockResolvedValue(existing as never)

    const req = makeRequest('PATCH', `http://localhost/api/organizations/${ORG_ID}`, {})
    const res = await PATCH(req, { params: Promise.resolve({ id: ORG_ID }) })
    expect(res.status).toBe(400)
  })
})

// ---------------------------------------------------------------------------
// DELETE /api/organizations/[id] — blocked when open conversations exist
// ---------------------------------------------------------------------------

describe('DELETE /api/organizations/[id]', () => {
  it('returns 409 when the org has open conversations', async () => {
    vi.mocked(requireAuth).mockResolvedValue({ workspaceId: WORKSPACE_ID, via: 'session' })

    const org = {
      id: ORG_ID,
      workspaceId: WORKSPACE_ID,
      name: 'Acme',
    }
    vi.mocked(prisma.organization.findFirst).mockResolvedValue(org as never)
    // Open = ACTIVE + ESCALATED + HUMAN_ACTIVE statuses
    vi.mocked(prisma.conversation.count).mockResolvedValue(3)

    const req = makeRequest('DELETE', `http://localhost/api/organizations/${ORG_ID}`)
    const res = await DELETE(req, { params: Promise.resolve({ id: ORG_ID }) })

    expect(res.status).toBe(409)
  })

  it('deletes when no open conversations exist', async () => {
    vi.mocked(requireAuth).mockResolvedValue({ workspaceId: WORKSPACE_ID, via: 'session' })

    const org = {
      id: ORG_ID,
      workspaceId: WORKSPACE_ID,
      name: 'Acme',
    }
    vi.mocked(prisma.organization.findFirst).mockResolvedValue(org as never)
    vi.mocked(prisma.conversation.count).mockResolvedValue(0)
    vi.mocked(prisma.organization.delete).mockResolvedValue(org as never)

    const req = makeRequest('DELETE', `http://localhost/api/organizations/${ORG_ID}`)
    const res = await DELETE(req, { params: Promise.resolve({ id: ORG_ID }) })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.deleted).toBe(true)
    expect(prisma.organization.delete).toHaveBeenCalledWith({
      where: { id: ORG_ID, workspaceId: WORKSPACE_ID },
    })
  })

  it('returns 404 when org not found', async () => {
    vi.mocked(requireAuth).mockResolvedValue({ workspaceId: WORKSPACE_ID, via: 'session' })
    vi.mocked(prisma.organization.findFirst).mockResolvedValue(null)

    const req = makeRequest('DELETE', `http://localhost/api/organizations/missing_id`)
    const res = await DELETE(req, { params: Promise.resolve({ id: 'missing_id' }) })
    expect(res.status).toBe(404)
  })
})
