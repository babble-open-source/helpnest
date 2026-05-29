/**
 * Integration test harness for the K1+K2 ticketing foundation.
 *
 * Exports:
 *  - testDb            — dedicated PrismaClient for the helpnest_test database
 *  - truncateTicketingTables() — clears ticketing-related data between tests
 *  - createTestWorkspace(slugSuffix?) — workspace + owner user + member
 *  - createTestConversation(workspaceId) — minimal ACTIVE conversation
 *
 * Guard note: truncateTicketingTables() wraps every statement for the new
 * tables/columns (Contact, Organization, ContactOrganization, WorkspaceCounter,
 * ConversationEvent, Conversation.number/contactId/organizationId,
 * Message.isInternal/authorMemberId) in a try/catch that silently ignores
 * Postgres error 42P01 (undefined_table) and 42703 (undefined_column).
 * These tables/columns are added in Tasks 2-4. The guards are intentional
 * scaffolding — tighten them (or remove the try/catch blocks) once those
 * migrations have landed.
 */

import path from 'path'
import dotenv from 'dotenv'
import { createPrismaClient } from '@helpnest/db'

// Re-load .env.test so direct imports of this module work outside the
// vitest runner (e.g. in scripts). override:true is safe — values are
// localhost-only test credentials.
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

// ---------------------------------------------------------------------------
// Postgres error codes we tolerate in truncateTicketingTables() while the
// new schema objects (Tasks 2-4) do not yet exist.
// ---------------------------------------------------------------------------
const UNDEFINED_TABLE = '42P01'
const UNDEFINED_COLUMN = '42703'

/**
 * Returns true if the error is a "table/column does not exist" Postgres error.
 *
 * In Prisma 7.5 with the driver-adapter (PrismaPg), raw-query failures are
 * wrapped as PrismaClientKnownRequestError with code P2010. The original
 * Postgres code is nested at meta.driverAdapterError.cause.originalCode.
 * We check both the top-level code (pre-7.5 style) and the nested path.
 */
function isExpectedSchemaError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as Record<string, unknown>

  // Direct Postgres error code (pre-driver-adapter or non-Prisma errors)
  if (e['code'] === UNDEFINED_TABLE || e['code'] === UNDEFINED_COLUMN) return true

  // Prisma 7.5 driver-adapter wrapping: P2010 with nested originalCode
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
 * Truncates all ticketing-related tables and resets columns added in Tasks 2-4.
 *
 * Safe to call at Task 1 — every statement targeting a not-yet-existing
 * table or column is individually guarded. Once Tasks 2-4 land, remove
 * the try/catch wrappers and the `isExpectedSchemaError` guard so failures
 * surface instead of being swallowed.
 */
export async function truncateTicketingTables(): Promise<void> {
  // Tables that do not exist yet (Tasks 2-4) — guarded individually.
  const futureTableStatements: string[] = [
    `TRUNCATE TABLE "ConversationEvent" RESTART IDENTITY CASCADE`,
    `TRUNCATE TABLE "ContactOrganization" RESTART IDENTITY CASCADE`,
    `TRUNCATE TABLE "WorkspaceCounter" RESTART IDENTITY CASCADE`,
    `TRUNCATE TABLE "Contact" RESTART IDENTITY CASCADE`,
    `TRUNCATE TABLE "Organization" RESTART IDENTITY CASCADE`,
  ]

  for (const sql of futureTableStatements) {
    try {
      await testDb.$executeRawUnsafe(sql)
    } catch (err) {
      if (!isExpectedSchemaError(err)) throw err
      // Table does not exist yet — expected until Task 2/3 lands; skip.
    }
  }

  // Reset new columns on existing tables (Tasks 2-4).
  // Guarded individually — columns do not exist at Task 1.
  const futureColumnStatements: string[] = [
    `UPDATE "Conversation" SET "number" = NULL, "contactId" = NULL, "organizationId" = NULL`,
    `UPDATE "Message" SET "isInternal" = FALSE, "authorMemberId" = NULL`,
  ]

  for (const sql of futureColumnStatements) {
    try {
      await testDb.$executeRawUnsafe(sql)
    } catch (err) {
      if (!isExpectedSchemaError(err)) throw err
      // Column does not exist yet — expected until Task 4 lands; skip.
    }
  }
}

// ---------------------------------------------------------------------------
// Workspace / conversation factory helpers
// ---------------------------------------------------------------------------

interface TestWorkspace {
  workspaceId: string
  userId: string
  memberId: string
}

/**
 * Creates a Workspace + User + Member(OWNER) in the test database.
 *
 * @param slugSuffix - Optional suffix appended to the generated slug for
 *   disambiguation when multiple workspaces are created in one test.
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
  }
}

interface TestConversation {
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
