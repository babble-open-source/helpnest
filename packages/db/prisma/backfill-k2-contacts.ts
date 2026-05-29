/**
 * Backfill script: K2 contacts + conversation numbering.
 *
 * Idempotent — safe to run multiple times. Skips rows already processed.
 *
 * Usage (one-time, run after Migration A on production data):
 *   DATABASE_URL=postgresql://... tsx packages/db/prisma/backfill-k2-contacts.ts
 *
 * The core logic is exported as runBackfill(db) so integration tests can
 * import it and run it against testDb without spinning up a separate process.
 *
 * Per-workspace algorithm:
 *   1. Number un-numbered conversations (number IS NULL) sequentially by
 *      createdAt. Update WorkspaceCounter.lastConversationNumber to the new max.
 *   2. For each conversation without a contactId that has customerEmail or
 *      visitorId, resolve-or-create a Contact via resolveOrCreateContact.
 *   3. Auto-associate the contact with an Organisation via autoAssociateContactToOrg
 *      (skips free-mail domains; matches on Org.domains array).
 *   4. Set Conversation.contactId and Conversation.organizationId.
 *   5. Emit CONTACT_LINKED (and ORG_LINKED) ConversationEvents with
 *      actorType=SYSTEM and payload.source='BACKFILL'. Guards prevent duplicate
 *      events on re-runs.
 *
 * Performance note: for very large workspaces (millions of conversations), the
 * sequential per-row numbering loop should be replaced with a single batch SQL
 * UPDATE using ROW_NUMBER() OVER (ORDER BY "createdAt"). The current approach
 * is chosen for auditability and simplicity at typical self-hosted scale.
 */

import path from 'node:path'

// Guard: only load .env when running as a CLI script, not when imported by
// tests (vitest setup.ts already loaded .env.test with the test DATABASE_URL).
const scriptPath =
  typeof process !== 'undefined' && process.argv[1]
    ? path.resolve(process.argv[1])
    : null

const isScript =
  scriptPath !== null &&
  (scriptPath === path.resolve(__filename) ||
    scriptPath === path.resolve(__filename.replace(/\.ts$/, '.js')))

if (isScript) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const dotenv = require('dotenv') as typeof import('dotenv')
  dotenv.config({ path: path.resolve(__dirname, '../../../.env') })
}

import { PrismaClient, Prisma } from '../generated/prisma/client'
import { resolveOrCreateContact } from '../../../apps/web/src/lib/contact-resolver'
import { autoAssociateContactToOrg } from '../../../apps/web/src/lib/org-associator'
import { emitConversationEvent } from '../../../apps/web/src/lib/conversation-events'

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Runs the full backfill across all workspaces in the database.
 *
 * Accepts any PrismaClient-compatible instance so integration tests can
 * inject testDb without needing a second database connection.
 */
export async function runBackfill(db: PrismaClient): Promise<void> {
  const workspaces = await db.workspace.findMany({ select: { id: true } })
  console.log(`Backfilling ${workspaces.length} workspace(s)…`)

  for (const workspace of workspaces) {
    await backfillWorkspace(db, workspace.id)
  }

  console.log('Backfill complete.')
}

// ---------------------------------------------------------------------------
// Per-workspace logic
// ---------------------------------------------------------------------------

async function backfillWorkspace(db: PrismaClient, workspaceId: string): Promise<void> {
  await numberUnnumberedConversations(db, workspaceId)
  await resolveContacts(db, workspaceId)
}

/**
 * Assigns sequential numbers to conversations that have number=null.
 * Ordering is by createdAt ASC for stable, deterministic results.
 * Resumes from the current WorkspaceCounter value so partial runs are safe.
 */
async function numberUnnumberedConversations(
  db: PrismaClient,
  workspaceId: string
): Promise<void> {
  const unnumbered = await db.conversation.findMany({
    where: { workspaceId, number: null },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })

  if (unnumbered.length === 0) return

  // Resume from the current counter so partial previous runs are not clobbered.
  const counter = await db.workspaceCounter.findUnique({ where: { workspaceId } })
  let nextNumber = (counter?.lastConversationNumber ?? 0) + 1

  for (const conv of unnumbered) {
    await db.conversation.update({
      where: { id: conv.id },
      data: { number: nextNumber },
    })
    nextNumber++
  }

  const newMax = nextNumber - 1
  await db.workspaceCounter.upsert({
    where: { workspaceId },
    create: { workspaceId, lastConversationNumber: newMax },
    update: { lastConversationNumber: newMax },
  })
}

/**
 * For each conversation without a contactId, resolve or create a Contact
 * from the conversation's customerEmail / visitorId, auto-associate with an
 * Organisation if the domain matches, update the conversation FK fields, and
 * emit audit events.
 */
async function resolveContacts(db: PrismaClient, workspaceId: string): Promise<void> {
  const uncontacted = await db.conversation.findMany({
    where: { workspaceId, contactId: null },
    select: {
      id: true,
      customerEmail: true,
      visitorId: true,
      customerName: true,
    },
  })

  for (const conv of uncontacted) {
    // Nothing to resolve — skip conversations with no identity signal.
    if (!conv.customerEmail && !conv.visitorId) continue

    await db.$transaction(async (tx: Prisma.TransactionClient) => {
      const contact = await resolveOrCreateContact(tx, workspaceId, {
        email: conv.customerEmail ?? undefined,
        visitorId: conv.visitorId ?? undefined,
        fullName: conv.customerName ?? undefined,
      })

      const org = await autoAssociateContactToOrg(tx, workspaceId, contact)

      await tx.conversation.update({
        where: { id: conv.id },
        data: {
          contactId: contact.id,
          organizationId: org?.id ?? null,
        },
      })

      // Emit CONTACT_LINKED — idempotency guard: skip if already emitted.
      const existingContactEvent = await tx.conversationEvent.findFirst({
        where: { conversationId: conv.id, verb: 'CONTACT_LINKED' },
      })
      if (!existingContactEvent) {
        await emitConversationEvent({
          tx,
          workspaceId,
          conversationId: conv.id,
          actorType: 'SYSTEM',
          verb: 'CONTACT_LINKED',
          payload: { contactId: contact.id, source: 'BACKFILL' },
        })
      }

      // Emit ORG_LINKED — only when an org was associated.
      if (org !== null) {
        const existingOrgEvent = await tx.conversationEvent.findFirst({
          where: { conversationId: conv.id, verb: 'ORG_LINKED' },
        })
        if (!existingOrgEvent) {
          await emitConversationEvent({
            tx,
            workspaceId,
            conversationId: conv.id,
            actorType: 'SYSTEM',
            verb: 'ORG_LINKED',
            payload: { organizationId: org.id, source: 'BACKFILL' },
          })
        }
      }
    })
  }
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

if (isScript) {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    console.error('DATABASE_URL is not set')
    process.exit(1)
  }

  // Import createPrismaClient lazily here so the module can be imported in
  // tests without triggering the adapter instantiation.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createPrismaClient } = require('../src/index') as typeof import('../src/index')
  const prismaInstance = createPrismaClient(connectionString)

  runBackfill(prismaInstance)
    .then(() => prismaInstance.$disconnect())
    .catch((err: unknown) => {
      console.error('Backfill failed:', err)
      prismaInstance.$disconnect().catch(() => undefined)
      process.exit(1)
    })
}
