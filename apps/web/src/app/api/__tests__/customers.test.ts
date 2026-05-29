import { vi, beforeEach, describe, it, expect } from 'vitest'

// ---------------------------------------------------------------------------
// Module mocks — declared before any imports that pull in these modules
// ---------------------------------------------------------------------------

vi.mock('@/lib/db', () => ({
  prisma: {
    contact: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    contactOrganization: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    conversation: {
      findMany: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
    },
    organization: {
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/auth-api', () => ({ requireAuth: vi.fn() }))
vi.mock('@/lib/contact-resolver', () => ({ resolveOrCreateContact: vi.fn() }))
vi.mock('@/lib/org-associator', () => ({ autoAssociateContactToOrg: vi.fn() }))
vi.mock('@/lib/conversation-events', () => ({ emitConversationEvent: vi.fn() }))

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { GET, POST } from '@/app/api/customers/route'
import { GET as GET_ONE, PATCH, DELETE } from '@/app/api/customers/[id]/route'
import {
  GET as GET_ORGS,
  POST as POST_ORG,
  DELETE as DELETE_ORG,
} from '@/app/api/customers/[id]/organizations/route'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth-api'
import { autoAssociateContactToOrg } from '@/lib/org-associator'

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
const CONTACT_ID = 'cnt_test_001'

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// POST /api/customers — creates contact + domain auto-associates
// ---------------------------------------------------------------------------

describe('POST /api/customers', () => {
  it('returns 401 when unauthenticated', async () => {
    vi.mocked(requireAuth).mockResolvedValue(null)
    const req = makeRequest('POST', 'http://localhost/api/customers', {
      email: 'alice@acme.com',
      fullName: 'Alice',
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('creates a contact and runs domain auto-association', async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      workspaceId: WORKSPACE_ID,
      via: 'session',
    })

    const createdContact = {
      id: CONTACT_ID,
      workspaceId: WORKSPACE_ID,
      email: 'alice@acme.com',
      fullName: 'Alice Smith',
      phone: null,
      externalId: null,
      visitorId: null,
      avatarUrl: null,
      customFields: {},
      mergedIntoId: null,
      createdAt: new Date('2026-05-29T00:00:00Z'),
      updatedAt: new Date('2026-05-29T00:00:00Z'),
      organizations: [],
    }

    const fakeOrg = {
      id: 'org_acme',
      name: 'Acme Corp',
      workspaceId: WORKSPACE_ID,
      domains: ['acme.com'],
      plan: 'pro',
      tags: [],
      notes: null,
      ownerId: null,
      customFields: {},
      externalId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    // $transaction calls the callback with a tx object; we simulate by calling
    // the callback with our mocked prisma directly.
    vi.mocked(prisma.$transaction).mockImplementation(
      async (fn: (tx: typeof prisma) => Promise<unknown>) => {
        return fn(prisma as unknown as typeof prisma)
      }
    )

    vi.mocked(prisma.contact.create).mockResolvedValue(createdContact as never)
    vi.mocked(autoAssociateContactToOrg).mockResolvedValue(fakeOrg as never)

    const req = makeRequest('POST', 'http://localhost/api/customers', {
      email: 'alice@acme.com',
      fullName: 'Alice Smith',
    })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.id).toBe(CONTACT_ID)
    expect(body.email).toBe('alice@acme.com')
    // autoAssociateContactToOrg must have been called
    expect(autoAssociateContactToOrg).toHaveBeenCalledWith(
      expect.anything(), // tx
      WORKSPACE_ID,
      createdContact
    )
  })

  it('returns 400 when no identifying field is provided', async () => {
    vi.mocked(requireAuth).mockResolvedValue({ workspaceId: WORKSPACE_ID, via: 'session' })
    const req = makeRequest('POST', 'http://localhost/api/customers', { fullName: 'Ghost' })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})

// ---------------------------------------------------------------------------
// GET /api/customers — search by email
// ---------------------------------------------------------------------------

describe('GET /api/customers', () => {
  it('returns 401 when unauthenticated', async () => {
    vi.mocked(requireAuth).mockResolvedValue(null)
    const req = makeRequest('GET', 'http://localhost/api/customers?q=alice')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('returns paginated results with organizations and conversationCount', async () => {
    vi.mocked(requireAuth).mockResolvedValue({ workspaceId: WORKSPACE_ID, via: 'session' })

    const contacts = [
      {
        id: CONTACT_ID,
        email: 'alice@acme.com',
        fullName: 'Alice Smith',
        phone: null,
        externalId: null,
        visitorId: null,
        avatarUrl: null,
        customFields: {},
        mergedIntoId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        organizations: [
          {
            organization: { id: 'org_acme', name: 'Acme Corp', plan: 'pro' },
            isPrimary: true,
            role: null,
          },
        ],
        _count: { conversations: 3 },
      },
    ]

    vi.mocked(prisma.contact.findMany).mockResolvedValue(contacts as never)
    vi.mocked(prisma.contact.count).mockResolvedValue(1)

    const req = makeRequest('GET', 'http://localhost/api/customers?q=alice&page=1&limit=20')
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.total).toBe(1)
    expect(body.page).toBe(1)
    expect(body.limit).toBe(20)
    expect(body.data[0].email).toBe('alice@acme.com')
    expect(body.data[0].conversationCount).toBe(3)
    expect(body.data[0].organizations[0].organization.name).toBe('Acme Corp')
  })
})

// ---------------------------------------------------------------------------
// GET /api/customers/[id] — single contact detail
// ---------------------------------------------------------------------------

describe('GET /api/customers/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    vi.mocked(requireAuth).mockResolvedValue(null)
    const req = makeRequest('GET', `http://localhost/api/customers/${CONTACT_ID}`)
    const res = await GET_ONE(req, { params: Promise.resolve({ id: CONTACT_ID }) })
    expect(res.status).toBe(401)
  })

  it('returns contact with organizations when found', async () => {
    vi.mocked(requireAuth).mockResolvedValue({ workspaceId: WORKSPACE_ID, via: 'session' })

    const contact = {
      id: CONTACT_ID,
      workspaceId: WORKSPACE_ID,
      email: 'alice@acme.com',
      fullName: 'Alice Smith',
      phone: null,
      externalId: null,
      visitorId: null,
      avatarUrl: null,
      customFields: {},
      mergedIntoId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      organizations: [],
      conversations: [],
    }

    vi.mocked(prisma.contact.findFirst).mockResolvedValue(contact as never)

    const req = makeRequest('GET', `http://localhost/api/customers/${CONTACT_ID}`)
    const res = await GET_ONE(req, { params: Promise.resolve({ id: CONTACT_ID }) })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.id).toBe(CONTACT_ID)
    expect(body.email).toBe('alice@acme.com')
  })

  it('returns 404 for contact in another workspace', async () => {
    vi.mocked(requireAuth).mockResolvedValue({ workspaceId: WORKSPACE_ID, via: 'session' })
    vi.mocked(prisma.contact.findFirst).mockResolvedValue(null)

    const req = makeRequest('GET', `http://localhost/api/customers/other_id`)
    const res = await GET_ONE(req, { params: Promise.resolve({ id: 'other_id' }) })
    expect(res.status).toBe(404)
  })
})

// ---------------------------------------------------------------------------
// PATCH /api/customers/[id] — updates fullName
// ---------------------------------------------------------------------------

describe('PATCH /api/customers/[id]', () => {
  it('updates fullName and returns the updated contact', async () => {
    vi.mocked(requireAuth).mockResolvedValue({ workspaceId: WORKSPACE_ID, via: 'session' })

    const existing = {
      id: CONTACT_ID,
      workspaceId: WORKSPACE_ID,
      email: 'alice@acme.com',
      fullName: 'Alice Smith',
      mergedIntoId: null,
    }
    const updated = {
      ...existing,
      fullName: 'Alice Updated',
      organizations: [],
      updatedAt: new Date(),
    }

    vi.mocked(prisma.contact.findFirst).mockResolvedValue(existing as never)
    vi.mocked(prisma.contact.update).mockResolvedValue(updated as never)

    const req = makeRequest('PATCH', `http://localhost/api/customers/${CONTACT_ID}`, {
      fullName: 'Alice Updated',
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: CONTACT_ID }) })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.fullName).toBe('Alice Updated')
  })

  it('returns 404 for contact in another workspace', async () => {
    vi.mocked(requireAuth).mockResolvedValue({ workspaceId: WORKSPACE_ID, via: 'session' })
    vi.mocked(prisma.contact.findFirst).mockResolvedValue(null)

    const req = makeRequest('PATCH', `http://localhost/api/customers/other_id`, { fullName: 'X' })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'other_id' }) })
    expect(res.status).toBe(404)
  })

  it('returns 409 when trying to update a merged contact', async () => {
    vi.mocked(requireAuth).mockResolvedValue({ workspaceId: WORKSPACE_ID, via: 'session' })

    const merged = {
      id: CONTACT_ID,
      workspaceId: WORKSPACE_ID,
      email: 'old@acme.com',
      fullName: 'Old Alice',
      mergedIntoId: 'cnt_survivor',
    }
    vi.mocked(prisma.contact.findFirst).mockResolvedValue(merged as never)

    const req = makeRequest('PATCH', `http://localhost/api/customers/${CONTACT_ID}`, {
      fullName: 'New Name',
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: CONTACT_ID }) })
    expect(res.status).toBe(409)
  })
})

// ---------------------------------------------------------------------------
// DELETE /api/customers/[id] — soft-merge re-points conversations
// ---------------------------------------------------------------------------

describe('DELETE /api/customers/[id]', () => {
  it('re-points conversations and sets mergedIntoId when mergeIntoId provided', async () => {
    vi.mocked(requireAuth).mockResolvedValue({ workspaceId: WORKSPACE_ID, via: 'session' })

    const sourceContact = {
      id: CONTACT_ID,
      workspaceId: WORKSPACE_ID,
      email: 'alice@acme.com',
      fullName: 'Alice',
      mergedIntoId: null,
    }
    const survivorContact = {
      id: 'cnt_survivor',
      workspaceId: WORKSPACE_ID,
      email: 'alice.main@acme.com',
      fullName: 'Alice Main',
      mergedIntoId: null,
    }

    vi.mocked(prisma.contact.findFirst)
      .mockResolvedValueOnce(sourceContact as never) // source lookup
      .mockResolvedValueOnce(survivorContact as never) // survivor lookup

    vi.mocked(prisma.$transaction).mockImplementation(
      async (fn: (tx: typeof prisma) => Promise<unknown>) => {
        return fn(prisma as unknown as typeof prisma)
      }
    )

    vi.mocked(prisma.conversation.updateMany).mockResolvedValue({ count: 2 } as never)
    vi.mocked(prisma.contact.update).mockResolvedValue({
      ...sourceContact,
      mergedIntoId: 'cnt_survivor',
    } as never)

    const req = makeRequest('DELETE', `http://localhost/api/customers/${CONTACT_ID}`, {
      mergeIntoId: 'cnt_survivor',
    })
    const res = await DELETE(req, { params: Promise.resolve({ id: CONTACT_ID }) })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.merged).toBe(true)
    expect(body.survivorId).toBe('cnt_survivor')

    // Conversations must be re-pointed to the survivor
    expect(prisma.conversation.updateMany).toHaveBeenCalledWith({
      where: { contactId: CONTACT_ID, workspaceId: WORKSPACE_ID },
      data: { contactId: 'cnt_survivor' },
    })

    // Source contact must have mergedIntoId set
    expect(prisma.contact.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: CONTACT_ID },
        data: expect.objectContaining({ mergedIntoId: 'cnt_survivor' }),
      })
    )
  })

  it('hard-deletes when no conversations exist and no mergeIntoId', async () => {
    vi.mocked(requireAuth).mockResolvedValue({ workspaceId: WORKSPACE_ID, via: 'session' })

    const contact = {
      id: CONTACT_ID,
      workspaceId: WORKSPACE_ID,
      email: 'ghost@acme.com',
      fullName: 'Ghost',
      mergedIntoId: null,
    }
    vi.mocked(prisma.contact.findFirst).mockResolvedValue(contact as never)
    vi.mocked(prisma.conversation.count).mockResolvedValue(0)
    vi.mocked(prisma.contact.delete).mockResolvedValue(contact as never)

    const req = makeRequest('DELETE', `http://localhost/api/customers/${CONTACT_ID}`)
    const res = await DELETE(req, { params: Promise.resolve({ id: CONTACT_ID }) })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.deleted).toBe(true)
    expect(prisma.contact.delete).toHaveBeenCalledWith({ where: { id: CONTACT_ID } })
  })

  it('returns 409 when trying to hard-delete a contact with conversations', async () => {
    vi.mocked(requireAuth).mockResolvedValue({ workspaceId: WORKSPACE_ID, via: 'session' })

    const contact = {
      id: CONTACT_ID,
      workspaceId: WORKSPACE_ID,
      email: 'busy@acme.com',
      fullName: 'Busy Bob',
      mergedIntoId: null,
    }
    vi.mocked(prisma.contact.findFirst).mockResolvedValue(contact as never)
    vi.mocked(prisma.conversation.count).mockResolvedValue(5)

    const req = makeRequest('DELETE', `http://localhost/api/customers/${CONTACT_ID}`)
    const res = await DELETE(req, { params: Promise.resolve({ id: CONTACT_ID }) })
    expect(res.status).toBe(409)
  })
})

// ---------------------------------------------------------------------------
// GET /api/customers/[id]/organizations — list memberships
// ---------------------------------------------------------------------------

describe('GET /api/customers/[id]/organizations', () => {
  it('returns 401 when unauthenticated', async () => {
    vi.mocked(requireAuth).mockResolvedValue(null)
    const req = makeRequest('GET', `http://localhost/api/customers/${CONTACT_ID}/organizations`)
    const res = await GET_ORGS(req, { params: Promise.resolve({ id: CONTACT_ID }) })
    expect(res.status).toBe(401)
  })

  it('returns memberships list', async () => {
    vi.mocked(requireAuth).mockResolvedValue({ workspaceId: WORKSPACE_ID, via: 'session' })

    vi.mocked(prisma.contact.findFirst).mockResolvedValue({
      id: CONTACT_ID,
      workspaceId: WORKSPACE_ID,
    } as never)

    const memberships = [
      {
        id: 'co_001',
        contactId: CONTACT_ID,
        organizationId: 'org_acme',
        workspaceId: WORKSPACE_ID,
        isPrimary: true,
        role: null,
        source: 'MANUAL',
        createdAt: new Date(),
        updatedAt: new Date(),
        organization: {
          id: 'org_acme',
          name: 'Acme Corp',
          plan: 'pro',
          domains: ['acme.com'],
          tags: [],
          ownerId: null,
        },
      },
    ]
    vi.mocked(prisma.contactOrganization.findMany).mockResolvedValue(memberships as never)

    const req = makeRequest('GET', `http://localhost/api/customers/${CONTACT_ID}/organizations`)
    const res = await GET_ORGS(req, { params: Promise.resolve({ id: CONTACT_ID }) })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].organization.name).toBe('Acme Corp')
    expect(body.data[0].isPrimary).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// POST /api/customers/[id]/organizations — add membership
// ---------------------------------------------------------------------------

describe('POST /api/customers/[id]/organizations', () => {
  it('returns 400 when organizationId is missing', async () => {
    vi.mocked(requireAuth).mockResolvedValue({ workspaceId: WORKSPACE_ID, via: 'session' })
    const req = makeRequest(
      'POST',
      `http://localhost/api/customers/${CONTACT_ID}/organizations`,
      {}
    )
    const res = await POST_ORG(req, { params: Promise.resolve({ id: CONTACT_ID }) })
    expect(res.status).toBe(400)
  })

  it('creates a new membership and returns 201', async () => {
    vi.mocked(requireAuth).mockResolvedValue({ workspaceId: WORKSPACE_ID, via: 'session' })

    vi.mocked(prisma.contact.findFirst).mockResolvedValue({
      id: CONTACT_ID,
      workspaceId: WORKSPACE_ID,
    } as never)
    vi.mocked(prisma.organization.findFirst).mockResolvedValue({
      id: 'org_acme',
      workspaceId: WORKSPACE_ID,
    } as never)
    vi.mocked(prisma.contactOrganization.findFirst).mockResolvedValue(null)

    const membership = {
      id: 'co_new',
      contactId: CONTACT_ID,
      organizationId: 'org_acme',
      workspaceId: WORKSPACE_ID,
      isPrimary: false,
      role: null,
      source: 'MANUAL',
      createdAt: new Date(),
      updatedAt: new Date(),
      organization: { id: 'org_acme', name: 'Acme Corp', plan: 'pro' },
    }
    vi.mocked(prisma.contactOrganization.create).mockResolvedValue(membership as never)

    const req = makeRequest('POST', `http://localhost/api/customers/${CONTACT_ID}/organizations`, {
      organizationId: 'org_acme',
      isPrimary: false,
    })
    const res = await POST_ORG(req, { params: Promise.resolve({ id: CONTACT_ID }) })
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.organizationId).toBe('org_acme')
    expect(body.organization.name).toBe('Acme Corp')
  })

  it('updates existing membership and returns 200', async () => {
    vi.mocked(requireAuth).mockResolvedValue({ workspaceId: WORKSPACE_ID, via: 'session' })

    vi.mocked(prisma.contact.findFirst).mockResolvedValue({
      id: CONTACT_ID,
      workspaceId: WORKSPACE_ID,
    } as never)
    vi.mocked(prisma.organization.findFirst).mockResolvedValue({
      id: 'org_acme',
      workspaceId: WORKSPACE_ID,
    } as never)

    const existingMembership = {
      id: 'co_001',
      contactId: CONTACT_ID,
      organizationId: 'org_acme',
      workspaceId: WORKSPACE_ID,
      isPrimary: false,
      role: null,
      source: 'DOMAIN',
    }
    vi.mocked(prisma.contactOrganization.findFirst).mockResolvedValue(existingMembership as never)

    const updatedMembership = {
      ...existingMembership,
      isPrimary: true,
      source: 'MANUAL',
      organization: { id: 'org_acme', name: 'Acme Corp', plan: 'pro' },
    }
    vi.mocked(prisma.contactOrganization.update).mockResolvedValue(updatedMembership as never)

    const req = makeRequest('POST', `http://localhost/api/customers/${CONTACT_ID}/organizations`, {
      organizationId: 'org_acme',
      isPrimary: true,
    })
    const res = await POST_ORG(req, { params: Promise.resolve({ id: CONTACT_ID }) })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.isPrimary).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// DELETE /api/customers/[id]/organizations — remove membership
// ---------------------------------------------------------------------------

describe('DELETE /api/customers/[id]/organizations', () => {
  it('returns 400 when organizationId is missing', async () => {
    vi.mocked(requireAuth).mockResolvedValue({ workspaceId: WORKSPACE_ID, via: 'session' })
    const req = makeRequest(
      'DELETE',
      `http://localhost/api/customers/${CONTACT_ID}/organizations`,
      {}
    )
    const res = await DELETE_ORG(req, { params: Promise.resolve({ id: CONTACT_ID }) })
    expect(res.status).toBe(400)
  })

  it('removes membership and returns { removed: true }', async () => {
    vi.mocked(requireAuth).mockResolvedValue({ workspaceId: WORKSPACE_ID, via: 'session' })

    vi.mocked(prisma.contact.findFirst).mockResolvedValue({
      id: CONTACT_ID,
      workspaceId: WORKSPACE_ID,
    } as never)

    const membership = {
      id: 'co_001',
      contactId: CONTACT_ID,
      organizationId: 'org_acme',
      workspaceId: WORKSPACE_ID,
    }
    vi.mocked(prisma.contactOrganization.findFirst).mockResolvedValue(membership as never)
    vi.mocked(prisma.contactOrganization.delete).mockResolvedValue(membership as never)

    const req = makeRequest(
      'DELETE',
      `http://localhost/api/customers/${CONTACT_ID}/organizations`,
      {
        organizationId: 'org_acme',
      }
    )
    const res = await DELETE_ORG(req, { params: Promise.resolve({ id: CONTACT_ID }) })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.removed).toBe(true)
    expect(prisma.contactOrganization.delete).toHaveBeenCalledWith({ where: { id: 'co_001' } })
  })
})
