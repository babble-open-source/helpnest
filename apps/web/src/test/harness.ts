/**
 * Integration test harness for the K1+K2 ticketing foundation.
 *
 * Exports:
 *  - testDb                   — dedicated PrismaClient for helpnest_test
 *  - registerTestDbTeardown() — call once per test file to disconnect testDb
 *  - truncateTicketingTables() — clears Conversation/Message rows + resets
 *                               ticketing-specific columns/tables between tests
 *  - createTestWorkspace(slugSuffix?) — workspace + owner user + member
 *  - createTestConversation(workspaceId) — minimal ACTIVE conversation
 *
 * Guard note: truncateTicketingTables() wraps every statement that targets
 * a not-yet-existing table or column (Contact, Organization,
 * ContactOrganization, WorkspaceCounter, ConversationEvent,
 * Conversation.number/contactId/organizationId, Message.isInternal/
 * authorMemberId) in an individual try/catch that silently ignores Postgres
 * errors 42P01 (undefined_table) and 42703 (undefined_column). These objects
 * arrive in Tasks 2-4. Each statement is guarded SEPARATELY so that when one
 * column exists but another doesn't (mid-rollout), the existing column is
 * still correctly reset. Remove the guards once all Tasks 2-4 have landed.
 */

import path from 'path'
import dotenv from 'dotenv'
import { afterAll } from 'vitest'
import { createPrismaClient } from '@helpnest/db'

// Re-load .env.test so direct imports of this module work outside the vitest
// runner (e.g. standalone scripts). override:true is intentional — values are
// localhost-only test credentials that must win over any ambient DATABASE_URL.
dotenv.config({
  path: path.resolve(__dirname, '../../.env.test'),
  override: true,
})

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('DATABASE_URL is not set — did .env.test load correctly?')
}

/** Dedicated Prisma client for the helpnest_test database. */
export const testDb = createPrismaClient(connectionString)

/**
 * Registers an afterAll hook that:
 *  1. Deletes all test Workspace rows whose slug starts with 'test-workspace-'
 *     (the prefix every createTestWorkspace() call uses). CASCADE removes the
 *     associated User, Member, Conversation, Contact, etc. rows automatically.
 *     This prevents unbounded accumulation — without cleanup, runBackfill()
 *     iterates all workspaces on every test run and grows proportionally.
 *  2. Disconnects testDb so the Postgres connection pool does not keep the
 *     Vitest process alive after the last test.
 *
 * Call this once at the top of every integration test file that imports testDb.
 */
export function registerTestDbTeardown(): void {
  afterAll(async () => {
    // Delete test workspaces created during this test run. The slug prefix
    // 'test-workspace-%' matches every slug produced by createTestWorkspace().
    // CASCADE on the FK constraints removes all dependent rows (Member, User,
    // Conversation, Contact, etc.) without needing to enumerate each table.
    try {
      await testDb.$executeRawUnsafe(
        `DELETE FROM "Workspace" WHERE slug LIKE 'test-workspace-%'`
      )
    } catch {
      // Best-effort: if the delete fails (e.g. FK violation not using CASCADE),
      // log and continue — a hung process is worse than leftover rows.
      // Subsequent runs will still clean up their own workspaces.
    }
    await testDb.$disconnect()
  })
}

// ---------------------------------------------------------------------------
// Postgres error codes we tolerate for not-yet-existing schema objects.
// ---------------------------------------------------------------------------
const UNDEFINED_TABLE = '42P01'
const UNDEFINED_COLUMN = '42703'

/**
 * Returns true if the error is a "table/column does not exist" Postgres error.
 *
 * In Prisma 7.5 with the driver-adapter (PrismaPg), raw-query failures are
 * wrapped as PrismaClientKnownRequestError with code P2010. The original
 * Postgres code sits at meta.driverAdapterError.cause.originalCode.
 * We check both the top-level code (pre-adapter style) and that nested path.
 */
function isExpectedSchemaError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as Record<string, unknown>

  if (e['code'] === UNDEFINED_TABLE || e['code'] === UNDEFINED_COLUMN) return true

  if (e['code'] === 'P2010') {
    const meta = e['meta'] as Record<string, unknown> | undefined
    const driverError = meta?.['driverAdapterError'] as Record<string, unknown> | undefined
    const cause = driverError?.['cause'] as Record<string, unknown> | undefined
    const originalCode = cause?.['originalCode'] as string | undefined
    if (originalCode === UNDEFINED_TABLE || originalCode === UNDEFINED_COLUMN) return true
  }

  return false
}

/**
 * Clears all ticketing-related data so tests are isolated from one another.
 *
 * Unguarded (these tables exist now, helpnest_test is ephemeral):
 *  - TRUNCATE "Message","Conversation" CASCADE — removes all conversation rows
 *    and their dependent messages, resetting foreign-key chains cleanly.
 *
 * Individually guarded (do not exist until Tasks 2-4):
 *  - Future tables: ConversationEvent, ContactOrganization, WorkspaceCounter,
 *    Contact, Organization
 *  - Future columns: Conversation.number, Conversation.contactId,
 *    Conversation.organizationId, Message.isInternal, Message.authorMemberId
 *
 * Each future-column UPDATE is its own guarded statement. This ensures that
 * mid-rollout (e.g. contactId exists but organizationId does not), the
 * column that already exists is still correctly reset rather than the whole
 * batch being skipped by a single catch.
 *
 * Remove each guard block once its Task has landed and the column/table is
 * confirmed present in all environments.
 */
export async function truncateTicketingTables(): Promise<void> {
  // --- Existing tables (unguarded) ----------------------------------------
  // CASCADE handles Message (and any other FK dependents on Conversation).
  await testDb.$executeRawUnsafe(`TRUNCATE TABLE "Message","Conversation" CASCADE`)

  // --- Future tables (Tasks 2-3) — individually guarded -------------------
  const futureTables = [
    `TRUNCATE TABLE "ConversationEvent" RESTART IDENTITY CASCADE`,
    `TRUNCATE TABLE "ContactOrganization" RESTART IDENTITY CASCADE`,
    `TRUNCATE TABLE "WorkspaceCounter" RESTART IDENTITY CASCADE`,
    `TRUNCATE TABLE "Contact" RESTART IDENTITY CASCADE`,
    `TRUNCATE TABLE "Organization" RESTART IDENTITY CASCADE`,
  ]

  for (const sql of futureTables) {
    try {
      await testDb.$executeRawUnsafe(sql)
    } catch (err) {
      if (!isExpectedSchemaError(err)) throw err
      // Table does not exist yet — expected until Task 2/3 lands.
    }
  }

  // --- Future columns on Conversation (Task 4) — one guard per column ------
  const futureConversationColumns = [
    `UPDATE "Conversation" SET "number" = NULL`,
    `UPDATE "Conversation" SET "contactId" = NULL`,
    `UPDATE "Conversation" SET "organizationId" = NULL`,
  ]

  for (const sql of futureConversationColumns) {
    try {
      await testDb.$executeRawUnsafe(sql)
    } catch (err) {
      if (!isExpectedSchemaError(err)) throw err
      // Column does not exist yet — expected until Task 4 lands.
    }
  }

  // --- Future columns on Message (Task 4) — one guard per column -----------
  const futureMessageColumns = [
    `UPDATE "Message" SET "isInternal" = FALSE`,
    `UPDATE "Message" SET "authorMemberId" = NULL`,
  ]

  for (const sql of futureMessageColumns) {
    try {
      await testDb.$executeRawUnsafe(sql)
    } catch (err) {
      if (!isExpectedSchemaError(err)) throw err
      // Column does not exist yet — expected until Task 4 lands.
    }
  }
}

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

export interface TestWorkspace {
  workspaceId: string
  userId: string
  memberId: string
  slug: string
}

/**
 * Creates a Workspace + User + Member(OWNER) in the test database.
 *
 * Each call generates a unique slug, so multiple workspaces can coexist
 * within a single test run without unique-constraint collisions.
 *
 * @param slugSuffix - Optional label appended to the slug for readability.
 */
export async function createTestWorkspace(slugSuffix?: string): Promise<TestWorkspace> {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const slug = slugSuffix ? `test-workspace-${unique}-${slugSuffix}` : `test-workspace-${unique}`

  const user = await testDb.user.create({
    data: {
      email: `test-${unique}@test.helpnest.local`,
      name: 'Test User',
    },
  })

  const workspace = await testDb.workspace.create({
    data: {
      name: 'Test Workspace',
      slug,
    },
  })

  const member = await testDb.member.create({
    data: {
      workspaceId: workspace.id,
      userId: user.id,
      role: 'OWNER',
    },
  })

  return {
    workspaceId: workspace.id,
    userId: user.id,
    memberId: member.id,
    slug,
  }
}

export interface TestConversation {
  conversationId: string
}

/**
 * Creates a minimal ACTIVE Conversation in the given workspace.
 */
export async function createTestConversation(workspaceId: string): Promise<TestConversation> {
  const conversation = await testDb.conversation.create({
    data: {
      workspaceId,
      status: 'ACTIVE',
    },
  })

  return { conversationId: conversation.id }
}
