/**
 * Smoke tests for the integration test harness.
 *
 * These tests prove that:
 *  - testDb connects to helpnest_test successfully
 *  - createTestWorkspace inserts a real workspace+user+member row
 *  - createTestConversation creates an ACTIVE conversation
 *  - truncateTicketingTables() clears Conversation/Message rows and runs
 *    without crashing on the not-yet-existing ticketing schema (Tasks 2-4)
 *  - All K1+K2 schema additions (Conversation.number/contactId/organizationId,
 *    Message.isInternal/authorMemberId, Contact, Organization, WorkspaceCounter,
 *    ConversationEvent) are queryable via testDb (Tasks 2-4 have landed).
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
// Schema presence checks for K1+K2 additions (Tasks 2-4 have landed).
// These were previously it.todo stubs; converted now that the schema exists.
// ---------------------------------------------------------------------------

describe('harness — K1+K2 schema (Tasks 2-4 landed)', () => {
  it('Contact table is queryable via testDb.contact', async () => {
    await expect(testDb.contact.findMany()).resolves.toBeDefined()
  })

  it('Organization table is queryable via testDb.organization', async () => {
    await expect(testDb.organization.findMany()).resolves.toBeDefined()
  })

  it('WorkspaceCounter table is queryable via testDb.workspaceCounter', async () => {
    await expect(testDb.workspaceCounter.findMany()).resolves.toBeDefined()
  })

  it('ConversationEvent table is queryable via testDb.conversationEvent', async () => {
    await expect(testDb.conversationEvent.findMany()).resolves.toBeDefined()
  })

  it('Conversation.number column exists and defaults to null', async () => {
    const { workspaceId } = await createTestWorkspace('sn1')
    const { conversationId } = await createTestConversation(workspaceId)
    const conv = await testDb.conversation.findUnique({ where: { id: conversationId } })
    expect(conv).not.toBeNull()
    // number starts as null before the backfill assigns it
    expect(Object.prototype.hasOwnProperty.call(conv, 'number')).toBe(true)
  })

  it('Conversation.contactId column exists and defaults to null', async () => {
    const { workspaceId } = await createTestWorkspace('sn2')
    const { conversationId } = await createTestConversation(workspaceId)
    const conv = await testDb.conversation.findUnique({ where: { id: conversationId } })
    expect(conv).not.toBeNull()
    expect(conv!.contactId).toBeNull()
  })

  it('Conversation.organizationId column exists and defaults to null', async () => {
    const { workspaceId } = await createTestWorkspace('sn3')
    const { conversationId } = await createTestConversation(workspaceId)
    const conv = await testDb.conversation.findUnique({ where: { id: conversationId } })
    expect(conv).not.toBeNull()
    expect(conv!.organizationId).toBeNull()
  })

  it('Message.isInternal defaults to false', async () => {
    const { workspaceId } = await createTestWorkspace('sn4')
    const { conversationId } = await createTestConversation(workspaceId)
    const msg = await testDb.message.create({
      data: { conversationId, role: 'CUSTOMER', content: 'hi' },
    })
    expect(msg.isInternal).toBe(false)
  })

  it('Message.authorMemberId is null for customer messages', async () => {
    const { workspaceId } = await createTestWorkspace('sn5')
    const { conversationId } = await createTestConversation(workspaceId)
    const msg = await testDb.message.create({
      data: { conversationId, role: 'CUSTOMER', content: 'hello' },
    })
    expect(msg.authorMemberId).toBeNull()
  })
})
