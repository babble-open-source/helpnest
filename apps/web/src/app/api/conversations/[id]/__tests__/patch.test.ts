import { vi, beforeEach, describe, it, expect } from 'vitest'

// ── module mocks (hoisted — no top-level variable references in factories) ──

vi.mock('@/lib/db', () => ({
  prisma: {
    conversation: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    contact: { findFirst: vi.fn() },
    organization: { findFirst: vi.fn() },
    member: { findFirst: vi.fn() },
    // $transaction: delegate to the callback with a proxy so all inner Prisma
    // calls use the same vi.fn() instances and assertions stay unchanged.
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/auth-api', () => ({ requireAuth: vi.fn() }))

vi.mock('@/lib/conversation-events', () => ({
  emitConversationEvent: vi.fn(),
}))

// ── imports (after mocks) ────────────────────────────────────────────────────

import { PATCH } from '../route'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth-api'
import { emitConversationEvent } from '@/lib/conversation-events'

// ── helpers ──────────────────────────────────────────────────────────────────

function makeRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost/api/conversations/conv-1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const PARAMS = Promise.resolve({ id: 'conv-1' })

beforeEach(() => {
  vi.clearAllMocks()

  vi.mocked(requireAuth).mockResolvedValue({
    workspaceId: 'ws-1',
    userId: 'user-1',
    via: 'session',
  } as never)

  vi.mocked(prisma.conversation.findFirst).mockResolvedValue({
    id: 'conv-1',
    workspaceId: 'ws-1',
    status: 'ESCALATED',
    contactId: null,
    organizationId: null,
    createdAt: new Date('2026-05-29T09:00:00Z'),
  } as never)

  vi.mocked(prisma.conversation.update).mockResolvedValue({
    id: 'conv-1',
    workspaceId: 'ws-1',
    status: 'HUMAN_ACTIVE',
    contactId: null,
    organizationId: null,
  } as never)

  vi.mocked(prisma.member.findFirst).mockResolvedValue({
    id: 'member-1',
    user: { name: 'Agent Smith', email: 'agent@ws.com' },
  } as never)

  vi.mocked(emitConversationEvent).mockResolvedValue(undefined)

  // $transaction: execute the callback immediately with a thin proxy that
  // delegates to the same vi.fn() mocks so assertions remain unchanged.
  ;(prisma.$transaction as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    async (fn: unknown) => {
      const txProxy = {
        conversation: { update: vi.mocked(prisma.conversation.update) },
      }
      return (fn as (tx: typeof txProxy) => Promise<unknown>)(txProxy)
    }
  )
})

// ── tests ─────────────────────────────────────────────────────────────────────

describe('PATCH /api/conversations/[id]', () => {
  it('accepts HUMAN_ACTIVE as a valid status and returns 200', async () => {
    vi.mocked(prisma.conversation.update).mockResolvedValue({
      id: 'conv-1',
      status: 'HUMAN_ACTIVE',
    } as never)
    const res = await PATCH(makeRequest({ status: 'HUMAN_ACTIVE' }), { params: PARAMS })
    expect(res.status).toBe(200)
  })

  it('rejects an unknown status with 400', async () => {
    const res = await PATCH(makeRequest({ status: 'NOPE' }), { params: PARAMS })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/invalid status/i)
  })

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(requireAuth).mockResolvedValue(null as never)
    const res = await PATCH(makeRequest({ status: 'HUMAN_ACTIVE' }), { params: PARAMS })
    expect(res.status).toBe(401)
  })

  it('scopes conversation lookup to the authenticated workspaceId', async () => {
    vi.mocked(prisma.conversation.findFirst).mockResolvedValue(null as never)
    const res = await PATCH(makeRequest({ status: 'HUMAN_ACTIVE' }), { params: PARAMS })
    expect(res.status).toBe(404)
    // Confirm the where-clause included workspaceId
    expect(prisma.conversation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ workspaceId: 'ws-1' }) })
    )
  })

  it('returns 400 when linking a contact that belongs to a different workspace', async () => {
    vi.mocked(prisma.contact.findFirst).mockResolvedValue(null as never)
    const res = await PATCH(makeRequest({ contactId: 'contact-foreign' }), { params: PARAMS })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/contact not found/i)
  })

  it('links a valid contactId, updates the conversation, and emits CONTACT_LINKED', async () => {
    vi.mocked(prisma.contact.findFirst).mockResolvedValue({
      id: 'contact-1',
      workspaceId: 'ws-1',
      email: 'a@b.com',
      fullName: 'Alice',
    } as never)
    vi.mocked(prisma.conversation.update).mockResolvedValue({
      id: 'conv-1',
      contactId: 'contact-1',
    } as never)

    const res = await PATCH(makeRequest({ contactId: 'contact-1' }), { params: PARAMS })
    expect(res.status).toBe(200)

    expect(prisma.conversation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'conv-1', workspaceId: 'ws-1' }),
        data: expect.objectContaining({ contactId: 'contact-1' }),
      })
    )
    expect(emitConversationEvent).toHaveBeenCalledWith(
      expect.objectContaining({ verb: 'CONTACT_LINKED', conversationId: 'conv-1' })
    )
  })

  it('returns 400 when linking an organizationId from a different workspace', async () => {
    vi.mocked(prisma.organization.findFirst).mockResolvedValue(null as never)
    const res = await PATCH(makeRequest({ organizationId: 'org-foreign' }), { params: PARAMS })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/organization not found/i)
  })

  it('links a valid organizationId and emits ORG_LINKED', async () => {
    vi.mocked(prisma.organization.findFirst).mockResolvedValue({
      id: 'org-1',
      workspaceId: 'ws-1',
      name: 'Acme',
    } as never)
    vi.mocked(prisma.conversation.update).mockResolvedValue({
      id: 'conv-1',
      organizationId: 'org-1',
    } as never)

    const res = await PATCH(makeRequest({ organizationId: 'org-1' }), { params: PARAMS })
    expect(res.status).toBe(200)
    expect(emitConversationEvent).toHaveBeenCalledWith(
      expect.objectContaining({ verb: 'ORG_LINKED', conversationId: 'conv-1' })
    )
  })

  it('emits STATUS_CHANGED when status changes', async () => {
    // conversation.status is 'ESCALATED' in beforeEach; change to HUMAN_ACTIVE
    const res = await PATCH(makeRequest({ status: 'HUMAN_ACTIVE' }), { params: PARAMS })
    expect(res.status).toBe(200)
    expect(emitConversationEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        verb: 'STATUS_CHANGED',
        payload: expect.objectContaining({ from: 'ESCALATED', to: 'HUMAN_ACTIVE' }),
      })
    )
  })

  it('emits STATUS_CHANGED and RESOLVED when status is RESOLVED_HUMAN', async () => {
    vi.mocked(prisma.conversation.update).mockResolvedValue({
      id: 'conv-1',
      status: 'RESOLVED_HUMAN',
    } as never)

    const res = await PATCH(makeRequest({ status: 'RESOLVED_HUMAN' }), { params: PARAMS })
    expect(res.status).toBe(200)

    expect(emitConversationEvent).toHaveBeenCalledWith(
      expect.objectContaining({ verb: 'STATUS_CHANGED' })
    )
    expect(emitConversationEvent).toHaveBeenCalledWith(
      expect.objectContaining({ verb: 'RESOLVED', durationSeconds: expect.any(Number) })
    )
  })

  it('does NOT emit STATUS_CHANGED when status is unchanged', async () => {
    // findFirst returns status 'ESCALATED'; patch also sends 'ESCALATED' — no change
    vi.mocked(prisma.conversation.findFirst).mockResolvedValue({
      id: 'conv-1',
      workspaceId: 'ws-1',
      status: 'ESCALATED',
      contactId: null,
      organizationId: null,
      createdAt: new Date('2026-05-29T09:00:00Z'),
    } as never)

    const res = await PATCH(makeRequest({ status: 'ESCALATED' }), { params: PARAMS })
    expect(res.status).toBe(200)
    const statusChangedCall = vi.mocked(emitConversationEvent).mock.calls.find(
      ([opts]) => opts.verb === 'STATUS_CHANGED'
    )
    expect(statusChangedCall).toBeUndefined()
  })
})
