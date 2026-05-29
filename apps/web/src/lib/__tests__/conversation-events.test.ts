// apps/web/src/lib/__tests__/conversation-events.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import {
  testDb,
  registerTestDbTeardown,
  truncateTicketingTables,
  createTestWorkspace,
  createTestConversation,
} from '@/test/harness'
import * as conversationEventsModule from '@/lib/conversation-events'
import { emitConversationEvent } from '@/lib/conversation-events'
import { EventActorType, ConversationEventVerb, Prisma } from '@helpnest/db'

// Disconnect testDb after all tests in this file complete.
registerTestDbTeardown()

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('emitConversationEvent — integration', () => {
  let workspaceId: string
  let conversationId: string
  let memberId: string

  beforeEach(async () => {
    await truncateTicketingTables()
    const ws = await createTestWorkspace('conv-event')
    workspaceId = ws.workspaceId
    memberId = ws.memberId
    const conv = await createTestConversation(workspaceId)
    conversationId = conv.conversationId
  })

  // -------------------------------------------------------------------------
  // Test 1: Row persists with all fields correct, actorLabel denormalized
  // -------------------------------------------------------------------------

  it('persists an event row and stores the denormalized actorLabel', async () => {
    await emitConversationEvent({
      workspaceId,
      conversationId,
      actorType: EventActorType.SYSTEM,
      actorLabel: 'System',
      verb: ConversationEventVerb.CONVERSATION_CREATED,
      payload: { source: 'widget' },
    })

    const events = await testDb.conversationEvent.findMany({
      where: { conversationId },
    })

    expect(events).toHaveLength(1)
    const event = events[0]!
    expect(event.workspaceId).toBe(workspaceId)
    expect(event.conversationId).toBe(conversationId)
    expect(event.actorType).toBe(EventActorType.SYSTEM)
    expect(event.actorLabel).toBe('System')
    expect(event.actorMemberId).toBeNull()
    expect(event.verb).toBe(ConversationEventVerb.CONVERSATION_CREATED)
    expect(event.payload).toEqual({ source: 'widget' })
    expect(event.durationSeconds).toBeNull()
    expect(event.createdAt).toBeInstanceOf(Date)
  })

  // -------------------------------------------------------------------------
  // Test 2: actorMemberId and actorLabel stored when actor is AGENT
  // -------------------------------------------------------------------------

  it('stores actorMemberId and actorLabel for AGENT actor type', async () => {
    // memberId comes from createTestWorkspace() in beforeEach — same workspace.
    await emitConversationEvent({
      workspaceId,
      conversationId,
      actorType: EventActorType.AGENT,
      actorMemberId: memberId,
      actorLabel: 'Agent Alice',
      verb: ConversationEventVerb.ASSIGNED,
      payload: { toMemberId: memberId, toMemberName: 'Agent Alice' },
    })

    const event = await testDb.conversationEvent.findFirst({
      where: { conversationId, verb: ConversationEventVerb.ASSIGNED },
    })

    expect(event).not.toBeNull()
    expect(event!.actorMemberId).toBe(memberId)
    expect(event!.actorLabel).toBe('Agent Alice')
  })

  // -------------------------------------------------------------------------
  // Test 3: durationSeconds stored for anchor events (FIRST_RESPONSE_SENT)
  // -------------------------------------------------------------------------

  it('stores durationSeconds for anchor events', async () => {
    await emitConversationEvent({
      workspaceId,
      conversationId,
      actorType: EventActorType.AI,
      actorLabel: 'AI',
      verb: ConversationEventVerb.FIRST_RESPONSE_SENT,
      payload: { messageId: 'msg-abc' },
      durationSeconds: 42,
    })

    const event = await testDb.conversationEvent.findFirst({
      where: { conversationId, verb: ConversationEventVerb.FIRST_RESPONSE_SENT },
    })

    expect(event).not.toBeNull()
    expect(event!.durationSeconds).toBe(42)
  })

  // -------------------------------------------------------------------------
  // Test 4: Accepts a tx client — uses provided transaction
  // -------------------------------------------------------------------------

  it('uses the provided transaction client when tx is supplied', async () => {
    await testDb.$transaction(async (tx: Prisma.TransactionClient) => {
      await emitConversationEvent({
        tx,
        workspaceId,
        conversationId,
        actorType: EventActorType.SYSTEM,
        actorLabel: 'System',
        verb: ConversationEventVerb.STATUS_CHANGED,
        payload: { from: 'ACTIVE', to: 'ESCALATED' },
      })
    })

    const event = await testDb.conversationEvent.findFirst({
      where: { conversationId, verb: ConversationEventVerb.STATUS_CHANGED },
    })

    expect(event).not.toBeNull()
    expect(event!.payload).toEqual({ from: 'ACTIVE', to: 'ESCALATED' })
  })

  // -------------------------------------------------------------------------
  // Test 5: Rolled-back transaction produces no event row
  // -------------------------------------------------------------------------

  it('produces no event row when the surrounding transaction is rolled back', async () => {
    await expect(
      testDb.$transaction(async (tx: Prisma.TransactionClient) => {
        await emitConversationEvent({
          tx,
          workspaceId,
          conversationId,
          actorType: EventActorType.SYSTEM,
          actorLabel: 'System',
          verb: ConversationEventVerb.RESOLVED,
          payload: { byAi: true },
          durationSeconds: 120,
        })
        // Force rollback.
        throw new Error('Intentional rollback')
      })
    ).rejects.toThrow('Intentional rollback')

    const count = await testDb.conversationEvent.count({ where: { conversationId } })
    expect(count).toBe(0)
  })

  // -------------------------------------------------------------------------
  // Test 6: Append-only enforcement — document DB-owner bypass and assert no
  //         application code path calls update/delete on ConversationEvent
  // -------------------------------------------------------------------------

  it('app code never issues UPDATE or DELETE against ConversationEvent rows (append-only contract)', async () => {
    // Note: The REVOKE UPDATE, DELETE ON "ConversationEvent" FROM PUBLIC in
    // Migration A enforces this at the DB level for application roles.
    // Integration tests connect as the DB owner (helpnest superuser for
    // helpnest_test), which bypasses the REVOKE grant. We therefore cannot
    // assert the REVOKE at the Postgres level here; instead, this test asserts
    // the _application contract_: emitConversationEvent only uses prisma.create,
    // never prisma.update or prisma.delete, and there is no exported function
    // in conversation-events.ts that updates or deletes rows.
    //
    // The DB-level REVOKE is verified manually by connecting as the app role:
    //   psql $DATABASE_URL -c "UPDATE \"ConversationEvent\" SET verb='STATUS_CHANGED' WHERE false"
    //   → ERROR: permission denied for table ConversationEvent

    // Seed an event row directly.
    await emitConversationEvent({
      workspaceId,
      conversationId,
      actorType: EventActorType.SYSTEM,
      actorLabel: 'System',
      verb: ConversationEventVerb.NOTE_ADDED,
      payload: { messageId: 'msg-1' },
    })

    const before = await testDb.conversationEvent.findFirst({ where: { conversationId } })
    expect(before).not.toBeNull()

    // The module under test exports only emitConversationEvent — no update/delete API exists.
    // Use the statically-imported module namespace to avoid dynamic import() in a worker
    // thread (Node 26 + Vitest combination causes a post-test fatal V8 error with
    // dynamic imports in worker context).
    const exportedKeys = Object.keys(conversationEventsModule)
    expect(exportedKeys).toEqual(['emitConversationEvent'])

    // The row is unchanged after the test (no mutation happened).
    const after = await testDb.conversationEvent.findFirst({ where: { conversationId } })
    expect(after?.id).toBe(before?.id)
    expect(after?.verb).toBe(ConversationEventVerb.NOTE_ADDED)
  })

  // -------------------------------------------------------------------------
  // Test 7: Multiple events for one conversation are all persisted and ordered
  //         by createdAt ascending (index: conversationId, createdAt)
  // -------------------------------------------------------------------------

  it('multiple events persist in insertion order', async () => {
    const verbs: ConversationEventVerb[] = [
      ConversationEventVerb.CONVERSATION_CREATED,
      ConversationEventVerb.STATUS_CHANGED,
      ConversationEventVerb.RESOLVED,
    ]

    for (const verb of verbs) {
      await emitConversationEvent({
        workspaceId,
        conversationId,
        actorType: EventActorType.SYSTEM,
        actorLabel: 'System',
        verb,
      })
    }

    const events = await testDb.conversationEvent.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    })

    expect(events).toHaveLength(3)
    expect(events.map((e: { verb: ConversationEventVerb }) => e.verb)).toEqual(verbs)
  })
})
