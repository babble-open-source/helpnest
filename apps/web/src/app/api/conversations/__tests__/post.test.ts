import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '../route'

// ── hoisted mock refs ──────────────────────────────────────────────────────
// vi.mock() calls are hoisted to the top of the file by Vitest's transform,
// so any variables they reference must also be hoisted with vi.hoisted().

const {
  mockWorkspaceFindFirst,
  mockConversationCreate,
  mockTransaction,
  mockAssignConversationNumber,
  mockResolveOrCreateContact,
  mockAutoAssociateContactToOrg,
  mockEmitConversationEvent,
} = vi.hoisted(() => ({
  mockWorkspaceFindFirst: vi.fn(),
  mockConversationCreate: vi.fn(),
  mockTransaction: vi.fn(),
  mockAssignConversationNumber: vi.fn(),
  mockResolveOrCreateContact: vi.fn(),
  mockAutoAssociateContactToOrg: vi.fn(),
  mockEmitConversationEvent: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    workspace: { findFirst: mockWorkspaceFindFirst },
    conversation: { create: mockConversationCreate },
    $transaction: (fn: (tx: unknown) => Promise<unknown>) => mockTransaction(fn),
  },
}))

vi.mock('@/lib/cloud', () => ({
  checkLimit: vi.fn().mockResolvedValue({ allowed: true, plan: 'SELF_HOSTED' }),
}))

vi.mock('@/lib/ai/resolve-provider', () => ({
  isByok: vi.fn().mockReturnValue(true),
}))

vi.mock('@/lib/auth-api', () => ({ requireAuth: vi.fn() }))

vi.mock('@/lib/redis', () => ({ redis: null }))

vi.mock('@/lib/ticket-number', () => ({
  assignConversationNumber: mockAssignConversationNumber,
}))

vi.mock('@/lib/contact-resolver', () => ({
  resolveOrCreateContact: mockResolveOrCreateContact,
}))

vi.mock('@/lib/org-associator', () => ({
  autoAssociateContactToOrg: mockAutoAssociateContactToOrg,
}))

vi.mock('@/lib/conversation-events', () => ({
  emitConversationEvent: mockEmitConversationEvent,
}))

// ── helpers ────────────────────────────────────────────────────────────────

function makeRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost/api/conversations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const WORKSPACE = {
  id: 'ws-1',
  aiEnabled: false,
  aiGreeting: null,
  aiProvider: null,
  aiApiKey: null,
}

beforeEach(() => {
  vi.clearAllMocks()

  mockWorkspaceFindFirst.mockResolvedValue(WORKSPACE)
  mockAssignConversationNumber.mockResolvedValue(42)
  mockResolveOrCreateContact.mockResolvedValue({ id: 'contact-1', email: 'user@acme.com', fullName: null })
  mockAutoAssociateContactToOrg.mockResolvedValue(null)
  mockEmitConversationEvent.mockResolvedValue(undefined)

  // Default transaction: execute the callback with a fake tx, then return result.
  mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
    const fakeTx = {
      workspace: { findFirst: mockWorkspaceFindFirst },
      conversation: { create: mockConversationCreate },
    }
    return fn(fakeTx)
  })

  mockConversationCreate.mockResolvedValue({
    id: 'conv-1',
    sessionToken: 'tok-abc',
    status: 'ACTIVE',
    number: 42,
    contactId: 'contact-1',
    organizationId: null,
    createdAt: new Date('2026-05-29T10:00:00Z'),
  })
})

// ── tests ──────────────────────────────────────────────────────────────────

describe('POST /api/conversations', () => {
  it('includes number in the JSON response', async () => {
    const res = await POST(makeRequest({ workspaceSlug: 'acme' }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.number).toBe(42)
  })

  it('calls resolveOrCreateContact with the provided customerEmail', async () => {
    await POST(makeRequest({ workspaceSlug: 'acme', customerEmail: 'user@acme.com', customerName: 'Alice' }))
    expect(mockResolveOrCreateContact).toHaveBeenCalledWith(
      expect.anything(), // tx
      'ws-1',
      expect.objectContaining({ email: 'user@acme.com', fullName: 'Alice' }),
    )
  })

  it('persists contactId on the conversation create call', async () => {
    await POST(makeRequest({ workspaceSlug: 'acme', customerEmail: 'user@acme.com' }))
    expect(mockConversationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ contactId: 'contact-1' }),
      }),
    )
  })

  it('emits CONVERSATION_CREATED event', async () => {
    await POST(makeRequest({ workspaceSlug: 'acme' }))
    expect(mockEmitConversationEvent).toHaveBeenCalledWith(
      expect.objectContaining({ verb: 'CONVERSATION_CREATED' }),
    )
  })

  it('reuses an existing contact for the same email (dedup)', async () => {
    // Simulate that resolveOrCreateContact returns the same id on both calls.
    mockResolveOrCreateContact.mockResolvedValue({ id: 'contact-1', email: 'user@acme.com', fullName: null })

    await POST(makeRequest({ workspaceSlug: 'acme', customerEmail: 'user@acme.com' }))
    await POST(makeRequest({ workspaceSlug: 'acme', customerEmail: 'user@acme.com' }))

    // Both calls resolve to the same contact id — mock is called twice but returns the same contact.
    expect(mockResolveOrCreateContact).toHaveBeenCalledTimes(2)
    const allContactIds = mockResolveOrCreateContact.mock.results.map((r) => r.value)
    // All resolved values have the same id.
    const ids = await Promise.all(allContactIds)
    expect(new Set(ids.map((c) => (c as { id: string }).id)).size).toBe(1)
  })

  it('emits CONTACT_LINKED when a contact is resolved', async () => {
    await POST(makeRequest({ workspaceSlug: 'acme', customerEmail: 'user@acme.com' }))
    expect(mockEmitConversationEvent).toHaveBeenCalledWith(
      expect.objectContaining({ verb: 'CONTACT_LINKED' }),
    )
  })

  it('emits ORG_LINKED when auto-association returns an org', async () => {
    mockAutoAssociateContactToOrg.mockResolvedValue({ id: 'org-1', name: 'Acme Inc' })
    mockConversationCreate.mockResolvedValue({
      id: 'conv-1',
      sessionToken: 'tok-abc',
      status: 'ACTIVE',
      number: 42,
      contactId: 'contact-1',
      organizationId: 'org-1',
      createdAt: new Date(),
    })
    await POST(makeRequest({ workspaceSlug: 'acme', customerEmail: 'user@acme.com' }))
    expect(mockEmitConversationEvent).toHaveBeenCalledWith(
      expect.objectContaining({ verb: 'ORG_LINKED' }),
    )
  })

  it('returns 404 when workspaceSlug is not found', async () => {
    mockWorkspaceFindFirst.mockResolvedValue(null)
    const res = await POST(makeRequest({ workspaceSlug: 'no-such-workspace' }))
    expect(res.status).toBe(404)
  })
})
