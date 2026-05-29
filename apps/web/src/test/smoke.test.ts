/**
 * Smoke tests for the integration test harness.
 *
 * These tests prove that:
 *  - testDb connects to helpnest_test successfully
 *  - createTestWorkspace inserts a real workspace+user+member row
 *  - createTestConversation creates an ACTIVE conversation
 *  - truncateTicketingTables() clears Conversation/Message rows and runs
 *    without crashing on the not-yet-existing ticketing schema (Tasks 2-4)
 *
 * Assertions about not-yet-existing columns/tables are marked it.todo
 * and will be enabled in their respective tasks:
 *  - Conversation.number / contactId / organizationId — Task 4
 *  - Message.isInternal / authorMemberId               — Task 4
 *  - Contact / Organization / WorkspaceCounter tables  — Tasks 2-3
 *  - ConversationEvent table                           — Task 2
 */

import { describe, it, expect } from 'vitest'
import {
  testDb,
  registerTestDbTeardown,
  truncateTicketingTables,
  createTestWorkspace,
  createTestConversation,
} from './harness'

// Disconnect the shared testDb client after all tests in this file complete.
registerTestDbTeardown()

describe('harness — database connectivity', () => {
  it('can execute a raw query against helpnest_test', async () => {
    const result = await testDb.$queryRaw<Array<{ one: number }>>`SELECT 1 AS one`
    expect(result[0].one).toBe(1)
  })

  it('reflects the helpnest_test DATABASE_URL', () => {
    expect(process.env.DATABASE_URL).toContain('helpnest_test')
  })
})

describe('harness — createTestWorkspace', () => {
  it('creates a workspace, user, and member row', async () => {
    const { workspaceId, userId, memberId, slug } = await createTestWorkspace('smoke')

    const workspace = await testDb.workspace.findUnique({ where: { id: workspaceId } })
    expect(workspace).not.toBeNull()
    expect(workspace!.slug).toBe(slug)
    expect(workspace!.slug).toMatch(/^test-workspace-/)

    const user = await testDb.user.findUnique({ where: { id: userId } })
    expect(user).not.toBeNull()
    expect(user!.email).toMatch(/@test\.helpnest\.local$/)

    const member = await testDb.member.findUnique({ where: { id: memberId } })
    expect(member).not.toBeNull()
    expect(member!.role).toBe('OWNER')
    expect(member!.workspaceId).toBe(workspaceId)
    expect(member!.userId).toBe(userId)
  })

  it('generates unique slugs when called multiple times', async () => {
    const a = await createTestWorkspace()
    const b = await createTestWorkspace()
    // Assert on slug (the unique-constrained value), not on CUID workspaceId.
    expect(a.slug).not.toBe(b.slug)
  })
})

describe('harness — createTestConversation', () => {
  it('creates an ACTIVE conversation in the given workspace', async () => {
    const { workspaceId } = await createTestWorkspace()
    const { conversationId } = await createTestConversation(workspaceId)

    const conversation = await testDb.conversation.findUnique({ where: { id: conversationId } })
    expect(conversation).not.toBeNull()
    expect(conversation!.workspaceId).toBe(workspaceId)
    expect(conversation!.status).toBe('ACTIVE')
  })
})

describe('harness — truncateTicketingTables', () => {
  it('runs without throwing at the Task 1 schema (new tables/columns guarded)', async () => {
    await expect(truncateTicketingTables()).resolves.not.toThrow()
  })

  it('can be called multiple times without error', async () => {
    await truncateTicketingTables()
    await truncateTicketingTables()
  })

  it('clears Conversation and Message rows', async () => {
    const { workspaceId } = await createTestWorkspace()
    const { conversationId } = await createTestConversation(workspaceId)

    // Confirm rows exist before truncate.
    const before = await testDb.conversation.findUnique({ where: { id: conversationId } })
    expect(before).not.toBeNull()

    await truncateTicketingTables()

    const after = await testDb.conversation.findUnique({ where: { id: conversationId } })
    expect(after).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Stubs for assertions that require schema additions in Tasks 2-4.
// Rename to it(...) and implement when the corresponding task lands.
// ---------------------------------------------------------------------------

describe('harness — future schema (Tasks 2-4)', () => {
  it.todo('Conversation.number is populated by ticket-number logic (Task 4)')
  it.todo('Conversation.contactId links to a Contact row (Task 2)')
  it.todo('Conversation.organizationId links to an Organization row (Task 3)')
  it.todo('Message.isInternal defaults to false (Task 4)')
  it.todo('Message.authorMemberId is null for AI/customer messages (Task 4)')
  it.todo('Contact table is queryable via testDb.contact (Task 2)')
  it.todo('Organization table is queryable via testDb.organization (Task 3)')
  it.todo('WorkspaceCounter table is queryable via testDb.workspaceCounter (Task 4)')
  it.todo('ConversationEvent table is queryable via testDb.conversationEvent (Task 2)')
})
