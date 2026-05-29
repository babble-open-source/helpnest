import { describe, it, expect, beforeEach } from 'vitest'
import { prisma } from '@/lib/db'
import { resolveOrCreateContact } from '@/lib/contact-resolver'
import type { Contact } from '@helpnest/db'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createWorkspace(slug: string): Promise<{ id: string }> {
  return prisma.workspace.create({
    data: {
      name: slug,
      slug,
      members: {
        create: {
          role: 'OWNER',
          user: {
            create: {
              email: `owner-${slug}@helpnest.test`,
              name: 'Owner',
            },
          },
        },
      },
    },
    select: { id: true },
  })
}

// ---------------------------------------------------------------------------
// Setup: truncate between tests so each case starts clean
// (setup.ts handles full truncation; this is an extra safety reset for models
//  added in this task that setup.ts also lists)
// ---------------------------------------------------------------------------

let workspaceId: string

beforeEach(async () => {
  // setup.ts already truncates Contact, Workspace, etc. via CASCADE.
  // Create a fresh workspace for each test.
  const ws = await createWorkspace(`ws-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  workspaceId = ws.id
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('resolveOrCreateContact — dedup by externalId', () => {
  it('returns the existing contact when externalId matches', async () => {
    const existing = await prisma.contact.create({
      data: { workspaceId, externalId: 'ext-001', email: 'alice@acme.com', fullName: 'Alice' },
    })

    const result = await prisma.$transaction((tx) =>
      resolveOrCreateContact(tx, workspaceId, { externalId: 'ext-001' })
    )

    expect(result.id).toBe(existing.id)
  })

  it('does not create a duplicate when externalId is present', async () => {
    await prisma.contact.create({
      data: { workspaceId, externalId: 'ext-002', email: 'bob@acme.com' },
    })

    await prisma.$transaction((tx) =>
      resolveOrCreateContact(tx, workspaceId, { externalId: 'ext-002' })
    )

    const count = await prisma.contact.count({ where: { workspaceId, externalId: 'ext-002' } })
    expect(count).toBe(1)
  })

  it('merges fullName when externalId matches and fullName is supplied', async () => {
    await prisma.contact.create({
      data: { workspaceId, externalId: 'ext-003' },
    })

    const result = await prisma.$transaction((tx) =>
      resolveOrCreateContact(tx, workspaceId, { externalId: 'ext-003', fullName: 'Carol' })
    )

    expect(result.fullName).toBe('Carol')
    const reloaded = await prisma.contact.findUniqueOrThrow({ where: { id: result.id } })
    expect(reloaded.fullName).toBe('Carol')
  })
})

describe('resolveOrCreateContact — dedup by email', () => {
  it('returns the existing contact when email matches (no externalId in input)', async () => {
    const existing = await prisma.contact.create({
      data: { workspaceId, email: 'dana@acme.com', fullName: 'Dana' },
    })

    const result = await prisma.$transaction((tx) =>
      resolveOrCreateContact(tx, workspaceId, { email: 'dana@acme.com' })
    )

    expect(result.id).toBe(existing.id)
  })

  it('merges fullName onto the email-matched contact', async () => {
    await prisma.contact.create({ data: { workspaceId, email: 'eve@acme.com' } })

    const result = await prisma.$transaction((tx) =>
      resolveOrCreateContact(tx, workspaceId, { email: 'eve@acme.com', fullName: 'Eve' })
    )

    expect(result.fullName).toBe('Eve')
  })

  it('does not overwrite an existing fullName when input fullName is absent', async () => {
    await prisma.contact.create({
      data: { workspaceId, email: 'frank@acme.com', fullName: 'Frank' },
    })

    const result = await prisma.$transaction((tx) =>
      resolveOrCreateContact(tx, workspaceId, { email: 'frank@acme.com' })
    )

    expect(result.fullName).toBe('Frank')
  })
})

describe('resolveOrCreateContact — dedup by visitorId', () => {
  it('returns the existing contact when visitorId matches (no externalId/email in input)', async () => {
    const existing = await prisma.contact.create({
      data: { workspaceId, visitorId: 'vis-abc' },
    })

    const result = await prisma.$transaction((tx) =>
      resolveOrCreateContact(tx, workspaceId, { visitorId: 'vis-abc' })
    )

    expect(result.id).toBe(existing.id)
  })

  it('merges fullName onto the visitorId-matched contact', async () => {
    await prisma.contact.create({ data: { workspaceId, visitorId: 'vis-xyz' } })

    const result = await prisma.$transaction((tx) =>
      resolveOrCreateContact(tx, workspaceId, { visitorId: 'vis-xyz', fullName: 'Grace' })
    )

    expect(result.fullName).toBe('Grace')
  })
})

describe('resolveOrCreateContact — no match → create', () => {
  it('creates a new contact when no key matches', async () => {
    const result = await prisma.$transaction((tx) =>
      resolveOrCreateContact(tx, workspaceId, {
        externalId: 'new-ext',
        email: 'new@acme.com',
        fullName: 'New User',
      })
    )

    expect(result.id).toBeDefined()
    expect(result.email).toBe('new@acme.com')
    expect(result.fullName).toBe('New User')
    expect(result.workspaceId).toBe(workspaceId)
  })

  it('creates an anonymous contact when all input keys are null/undefined', async () => {
    const result = await prisma.$transaction((tx) => resolveOrCreateContact(tx, workspaceId, {}))

    expect(result.id).toBeDefined()
    expect(result.email).toBeNull()
    expect(result.externalId).toBeNull()
    expect(result.visitorId).toBeNull()
    expect(result.workspaceId).toBe(workspaceId)
  })

  it('creates a separate anonymous contact on a second call with empty input', async () => {
    const first = await prisma.$transaction((tx) => resolveOrCreateContact(tx, workspaceId, {}))
    const second = await prisma.$transaction((tx) => resolveOrCreateContact(tx, workspaceId, {}))

    // Postgres treats NULL as distinct in unique indexes, so two anonymous contacts are allowed
    expect(first.id).not.toBe(second.id)
  })
})

describe('resolveOrCreateContact — follows mergedInto to survivor', () => {
  it('returns the survivor when the resolved contact has mergedIntoId set', async () => {
    const survivor = await prisma.contact.create({
      data: { workspaceId, email: 'survivor@acme.com', fullName: 'Survivor' },
    })
    // Ghost contact has been merged into survivor
    await prisma.contact.create({
      data: {
        workspaceId,
        externalId: 'ghost-ext',
        mergedIntoId: survivor.id,
      },
    })

    const result = await prisma.$transaction((tx) =>
      resolveOrCreateContact(tx, workspaceId, { externalId: 'ghost-ext' })
    )

    expect(result.id).toBe(survivor.id)
    expect(result.email).toBe('survivor@acme.com')
  })

  it('follows a two-hop merge chain to the final survivor', async () => {
    const final = await prisma.contact.create({
      data: { workspaceId, email: 'final@acme.com' },
    })
    const middle = await prisma.contact.create({
      data: { workspaceId, externalId: 'middle-ext', mergedIntoId: final.id },
    })
    await prisma.contact.create({
      data: { workspaceId, externalId: 'original-ext', mergedIntoId: middle.id },
    })

    const result = await prisma.$transaction((tx) =>
      resolveOrCreateContact(tx, workspaceId, { externalId: 'original-ext' })
    )

    expect(result.id).toBe(final.id)
  })
})
