// apps/web/src/lib/__tests__/ticket-number.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { prisma } from '@/lib/db'
import { assignConversationNumber } from '@/lib/ticket-number'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createTestWorkspace(slug: string): Promise<string> {
  // Upsert a minimal Workspace row so FK constraints are satisfied.
  const ws = await prisma.workspace.upsert({
    where: { slug },
    create: { slug, name: slug },
    update: {},
    select: { id: true },
  })
  return ws.id
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('assignConversationNumber — integration', () => {
  let workspaceId: string

  beforeEach(async () => {
    workspaceId = await createTestWorkspace('ticket-number-test-ws')
    // Ensure counter row is absent before each test so each test controls its own state.
    await prisma.workspaceCounter.deleteMany({ where: { workspaceId } })
  })

  // -------------------------------------------------------------------------
  // Test 1: First call auto-provisions counter row and returns 1
  // -------------------------------------------------------------------------

  it('returns 1 on the very first call when no counter row exists', async () => {
    const n = await prisma.$transaction((tx) => assignConversationNumber(tx, workspaceId))
    expect(n).toBe(1)

    const row = await prisma.workspaceCounter.findUnique({ where: { workspaceId } })
    expect(row?.lastConversationNumber).toBe(1)
  })

  // -------------------------------------------------------------------------
  // Test 2: Seeded counter returns next sequential value
  // -------------------------------------------------------------------------

  it('returns lastConversationNumber + 1 when a counter row is already seeded', async () => {
    // Seed counter at 41 (mimicking Migration A backfill).
    await prisma.workspaceCounter.create({
      data: { workspaceId, lastConversationNumber: 41 },
    })

    const n = await prisma.$transaction((tx) => assignConversationNumber(tx, workspaceId))
    expect(n).toBe(42)

    const row = await prisma.workspaceCounter.findUnique({ where: { workspaceId } })
    expect(row?.lastConversationNumber).toBe(42)
  })

  // -------------------------------------------------------------------------
  // Test 3: 10 parallel calls produce unique gapless numbers 1..10
  // -------------------------------------------------------------------------

  it('10 concurrent calls produce unique gapless numbers 1..10', async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        prisma.$transaction((tx) => assignConversationNumber(tx, workspaceId))
      )
    )

    const sorted = [...results].sort((a, b) => a - b)
    expect(sorted).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])

    // All values are unique (no duplicates from a lost update).
    expect(new Set(results).size).toBe(10)

    const row = await prisma.workspaceCounter.findUnique({ where: { workspaceId } })
    expect(row?.lastConversationNumber).toBe(10)
  })

  // -------------------------------------------------------------------------
  // Test 4: Counter does NOT advance when the outer transaction is rolled back
  // -------------------------------------------------------------------------

  it('does not advance the counter when the outer transaction is rolled back', async () => {
    // Seed at 5.
    await prisma.workspaceCounter.create({
      data: { workspaceId, lastConversationNumber: 5 },
    })

    // Run a transaction that calls assignConversationNumber but then throws.
    await expect(
      prisma.$transaction(async (tx) => {
        const n = await assignConversationNumber(tx, workspaceId)
        // Simulate a subsequent failure (e.g. FK violation, business rule error).
        throw new Error(`Intentional rollback after acquiring number ${n}`)
      })
    ).rejects.toThrow('Intentional rollback')

    // Counter must remain at 5 — the UPDATE was rolled back with the transaction.
    const row = await prisma.workspaceCounter.findUnique({ where: { workspaceId } })
    expect(row?.lastConversationNumber).toBe(5)
  })
})
