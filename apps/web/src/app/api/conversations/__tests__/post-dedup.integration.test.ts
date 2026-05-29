/**
 * Integration test: contact dedup across two POST /api/conversations calls.
 *
 * This file deliberately does NOT mock @/lib/db so that the route handler,
 * resolveOrCreateContact, assignConversationNumber, autoAssociateContactToOrg,
 * and emitConversationEvent all execute against the real helpnest_test database.
 *
 * The only mocks here are for infrastructure side-effects that have no bearing
 * on the dedup behaviour:
 *  - @/lib/cloud (plan limit check — always allowed)
 *  - @/lib/ai/resolve-provider (BYOK check — always true)
 *  - @/lib/redis (rate-limit redis — null, falls back to in-memory)
 *  - @/lib/auth-api (not called by POST, mocked for completeness)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '../route'
import {
  testDb,
  createTestWorkspace,
  truncateTicketingTables,
  registerTestDbTeardown,
} from '@/test/harness'

// ── Mocks for infrastructure side-effects only ────────────────────────────────
// @/lib/db is intentionally NOT mocked — the handler runs against helpnest_test.

vi.mock('@/lib/cloud', () => ({
  checkLimit: vi.fn().mockResolvedValue({ allowed: true, plan: 'SELF_HOSTED' }),
}))

vi.mock('@/lib/ai/resolve-provider', () => ({
  isByok: vi.fn().mockReturnValue(true),
}))

vi.mock('@/lib/redis', () => ({ redis: null }))

vi.mock('@/lib/auth-api', () => ({ requireAuth: vi.fn() }))

// ── Test lifecycle ────────────────────────────────────────────────────────────

registerTestDbTeardown()

let slug: string
let workspaceId: string

beforeEach(async () => {
  await truncateTicketingTables()
  const ws = await createTestWorkspace('dedup')
  slug = ws.slug
  workspaceId = ws.workspaceId
})

// ── Helper ────────────────────────────────────────────────────────────────────

function makeRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost/api/conversations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/conversations — contact dedup (real DB)', () => {
  it('reuses an existing contact for the same email across two requests', async () => {
    const res1 = await POST(makeRequest({ workspaceSlug: slug, customerEmail: 'user@acme.com' }))
    expect(res1.status).toBe(201)

    const res2 = await POST(makeRequest({ workspaceSlug: slug, customerEmail: 'user@acme.com' }))
    expect(res2.status).toBe(201)

    // Only one Contact row must exist for this workspace+email combination.
    const count = await testDb.contact.count({
      where: { workspaceId, email: 'user@acme.com' },
    })
    expect(count).toBe(1)
  })

  it('creates two separate conversations but links both to the same contact', async () => {
    await POST(makeRequest({ workspaceSlug: slug, customerEmail: 'user@acme.com' }))
    await POST(makeRequest({ workspaceSlug: slug, customerEmail: 'user@acme.com' }))

    const contact = await testDb.contact.findFirstOrThrow({
      where: { workspaceId, email: 'user@acme.com' },
    })

    const conversations = await testDb.conversation.findMany({
      where: { workspaceId, contactId: contact.id },
    })
    expect(conversations.length).toBe(2)
  })

  it('assigns distinct ticket numbers to each conversation', async () => {
    const r1 = await POST(makeRequest({ workspaceSlug: slug, customerEmail: 'user@acme.com' }))
    const r2 = await POST(makeRequest({ workspaceSlug: slug, customerEmail: 'user@acme.com' }))

    const b1 = (await r1.json()) as { number: number }
    const b2 = (await r2.json()) as { number: number }

    expect(b1.number).toBe(1)
    expect(b2.number).toBe(2)
  })
})
