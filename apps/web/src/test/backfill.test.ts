/**
 * Integration tests verifying the backfill-k2-contacts script behaviour.
 *
 * The backfill script lives in packages/db/prisma/backfill-k2-contacts.ts and
 * is imported here as a function so we can run it in-process against the test DB.
 *
 * Run: pnpm --filter @helpnest/web exec vitest run src/test/backfill.test.ts
 */
import { describe, it, expect, beforeEach } from 'vitest'
import type { Conversation, Contact } from '@helpnest/db'
import {
  testDb,
  createTestWorkspace,
  truncateTicketingTables,
  registerTestDbTeardown,
} from '@/test/harness'

// We import the exported runBackfill function from the script.
// The script must export a runBackfill(db) function for testability.
// Using a dynamic import to avoid the script's top-level dotenv call running
// at module-load time (setup.ts already loaded .env.test).
async function getBackfill() {
  const mod = await import('../../../../packages/db/prisma/backfill-k2-contacts')
  return mod.runBackfill
}

registerTestDbTeardown()

describe('backfill-k2-contacts', () => {
  let workspaceId: string

  beforeEach(async () => {
    await truncateTicketingTables()
    const ws = await createTestWorkspace('bf')
    workspaceId = ws.workspaceId
  })

  it('assigns sequential numbers to existing un-numbered conversations', async () => {
    // Create 3 conversations with no number set (pre-Migration-A state).
    const c1 = await testDb.conversation.create({ data: { workspaceId, status: 'ACTIVE' } })
    const c2 = await testDb.conversation.create({ data: { workspaceId, status: 'ACTIVE' } })
    const c3 = await testDb.conversation.create({ data: { workspaceId, status: 'ACTIVE' } })

    const runBackfill = await getBackfill()
    await runBackfill(testDb)

    const updated = await testDb.conversation.findMany({
      where: { id: { in: [c1.id, c2.id, c3.id] } },
      orderBy: { createdAt: 'asc' },
    })
    const numbers = updated.map((c: Conversation) => c.number)
    expect(numbers).toEqual([1, 2, 3])
  })

  it('is idempotent — running twice does not re-number already-numbered rows', async () => {
    const c1 = await testDb.conversation.create({ data: { workspaceId, status: 'ACTIVE' } })
    const c2 = await testDb.conversation.create({ data: { workspaceId, status: 'ACTIVE' } })

    const runBackfill = await getBackfill()
    await runBackfill(testDb)
    await runBackfill(testDb) // second run

    const updated = await testDb.conversation.findMany({
      where: { id: { in: [c1.id, c2.id] } },
      orderBy: { createdAt: 'asc' },
    })
    expect(updated.map((c: Conversation) => c.number)).toEqual([1, 2])
  })

  it('sets WorkspaceCounter.lastConversationNumber to the max assigned number', async () => {
    await testDb.conversation.create({ data: { workspaceId, status: 'ACTIVE' } })
    await testDb.conversation.create({ data: { workspaceId, status: 'ACTIVE' } })
    await testDb.conversation.create({ data: { workspaceId, status: 'ACTIVE' } })

    const runBackfill = await getBackfill()
    await runBackfill(testDb)

    const counter = await testDb.workspaceCounter.findUnique({ where: { workspaceId } })
    expect(counter!.lastConversationNumber).toBe(3)
  })

  it('creates Contact rows from distinct customerEmail values', async () => {
    await testDb.conversation.create({
      data: { workspaceId, status: 'ACTIVE', customerEmail: 'alice@acme.com' },
    })
    await testDb.conversation.create({
      data: { workspaceId, status: 'ACTIVE', customerEmail: 'alice@acme.com' }, // duplicate
    })
    await testDb.conversation.create({
      data: { workspaceId, status: 'ACTIVE', customerEmail: 'bob@acme.com' },
    })

    const runBackfill = await getBackfill()
    await runBackfill(testDb)

    const contacts = await testDb.contact.findMany({ where: { workspaceId } })
    // alice and bob — alice deduped
    expect(contacts.length).toBe(2)
    expect(contacts.map((c: Contact) => c.email).sort()).toEqual(['alice@acme.com', 'bob@acme.com'])
  })

  it('links conversations to their resolved contacts', async () => {
    const conv = await testDb.conversation.create({
      data: { workspaceId, status: 'ACTIVE', customerEmail: 'carol@acme.com' },
    })

    const runBackfill = await getBackfill()
    await runBackfill(testDb)

    const updated = await testDb.conversation.findUnique({ where: { id: conv.id } })
    expect(updated!.contactId).not.toBeNull()

    const contact = await testDb.contact.findUnique({ where: { id: updated!.contactId! } })
    expect(contact!.email).toBe('carol@acme.com')
  })

  it('emits CONTACT_LINKED ConversationEvents with actorType=SYSTEM', async () => {
    const conv = await testDb.conversation.create({
      data: { workspaceId, status: 'ACTIVE', customerEmail: 'dave@acme.com' },
    })

    const runBackfill = await getBackfill()
    await runBackfill(testDb)

    const events = await testDb.conversationEvent.findMany({
      where: { conversationId: conv.id, verb: 'CONTACT_LINKED' },
    })
    expect(events.length).toBe(1)
    expect(events[0].actorType).toBe('SYSTEM')
    expect((events[0].payload as { source: string })?.source).toBe('BACKFILL')
  })

  it('does not emit duplicate events on second run', async () => {
    const conv = await testDb.conversation.create({
      data: { workspaceId, status: 'ACTIVE', customerEmail: 'eve@acme.com' },
    })

    const runBackfill = await getBackfill()
    await runBackfill(testDb)
    await runBackfill(testDb)

    const events = await testDb.conversationEvent.findMany({
      where: { conversationId: conv.id, verb: 'CONTACT_LINKED' },
    })
    expect(events.length).toBe(1)
  })
})
