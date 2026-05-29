import { describe, it, expect, beforeEach } from 'vitest'
import { prisma } from '@/lib/db'
import { autoAssociateContactToOrg } from '@/lib/org-associator'
import type { Contact, Organization } from '@helpnest/db'

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

async function createContact(
  workspaceId: string,
  email: string | null,
  extras: Partial<{ fullName: string; visitorId: string; externalId: string }> = {},
): Promise<Contact> {
  return prisma.contact.create({
    data: { workspaceId, email, ...extras },
  })
}

async function createOrg(
  workspaceId: string,
  name: string,
  domains: string[],
): Promise<Organization> {
  return prisma.organization.create({
    data: { workspaceId, name, domains },
  })
}

// ---------------------------------------------------------------------------

let workspaceId: string

beforeEach(async () => {
  const ws = await createWorkspace(`ws-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  workspaceId = ws.id
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('autoAssociateContactToOrg — domain match', () => {
  it('returns the matched organization', async () => {
    const org = await createOrg(workspaceId, 'Acme Corp', ['acme.com'])
    const contact = await createContact(workspaceId, 'alice@acme.com')

    const result = await prisma.$transaction((tx) =>
      autoAssociateContactToOrg(tx, workspaceId, contact),
    )

    expect(result).not.toBeNull()
    expect(result!.id).toBe(org.id)
  })

  it('creates a ContactOrganization row with source DOMAIN', async () => {
    const org = await createOrg(workspaceId, 'Acme Corp', ['acme.com'])
    const contact = await createContact(workspaceId, 'bob@acme.com')

    await prisma.$transaction((tx) =>
      autoAssociateContactToOrg(tx, workspaceId, contact),
    )

    const link = await prisma.contactOrganization.findUnique({
      where: { contactId_organizationId: { contactId: contact.id, organizationId: org.id } },
    })
    expect(link).not.toBeNull()
    expect(link!.source).toBe('DOMAIN')
  })

  it('sets isPrimary: true for the first association', async () => {
    const org = await createOrg(workspaceId, 'Acme Corp', ['acme.com'])
    const contact = await createContact(workspaceId, 'carol@acme.com')

    await prisma.$transaction((tx) =>
      autoAssociateContactToOrg(tx, workspaceId, contact),
    )

    const link = await prisma.contactOrganization.findUnique({
      where: { contactId_organizationId: { contactId: contact.id, organizationId: org.id } },
    })
    expect(link!.isPrimary).toBe(true)
  })
})

describe('autoAssociateContactToOrg — free-mail skip', () => {
  it('returns null for a gmail.com address', async () => {
    await createOrg(workspaceId, 'Gmail Corp', ['gmail.com'])
    const contact = await createContact(workspaceId, 'user@gmail.com')

    const result = await prisma.$transaction((tx) =>
      autoAssociateContactToOrg(tx, workspaceId, contact),
    )

    expect(result).toBeNull()
  })

  it('returns null for a yahoo.com address', async () => {
    const contact = await createContact(workspaceId, 'user@yahoo.com')

    const result = await prisma.$transaction((tx) =>
      autoAssociateContactToOrg(tx, workspaceId, contact),
    )

    expect(result).toBeNull()
  })

  it('returns null when contact email is null', async () => {
    const contact = await createContact(workspaceId, null)

    const result = await prisma.$transaction((tx) =>
      autoAssociateContactToOrg(tx, workspaceId, contact),
    )

    expect(result).toBeNull()
  })

  it('returns null when contact email has no domain (malformed)', async () => {
    const contact = await createContact(workspaceId, 'nodomain')

    const result = await prisma.$transaction((tx) =>
      autoAssociateContactToOrg(tx, workspaceId, contact),
    )

    expect(result).toBeNull()
  })
})

describe('autoAssociateContactToOrg — multiple orgs on the same domain', () => {
  it('picks the first alphabetically by name', async () => {
    await createOrg(workspaceId, 'Zebra Division', ['shared.com'])
    const apple = await createOrg(workspaceId, 'Apple Division', ['shared.com'])
    await createOrg(workspaceId, 'Mango Division', ['shared.com'])
    const contact = await createContact(workspaceId, 'user@shared.com')

    const result = await prisma.$transaction((tx) =>
      autoAssociateContactToOrg(tx, workspaceId, contact),
    )

    expect(result!.id).toBe(apple.id)
    expect(result!.name).toBe('Apple Division')
  })
})

describe('autoAssociateContactToOrg — second link is not primary', () => {
  it('sets isPrimary: false when the contact already has a primary org', async () => {
    // Contact already has a primary link to firstOrg
    const firstOrg = await createOrg(workspaceId, 'First Corp', ['first.com'])
    const secondOrg = await createOrg(workspaceId, 'Second Corp', ['second.com'])
    const contact = await createContact(workspaceId, 'user@second.com')

    // Manually create the pre-existing primary link
    await prisma.contactOrganization.create({
      data: {
        workspaceId,
        contactId: contact.id,
        organizationId: firstOrg.id,
        isPrimary: true,
        source: 'MANUAL',
      },
    })

    await prisma.$transaction((tx) =>
      autoAssociateContactToOrg(tx, workspaceId, contact),
    )

    const link = await prisma.contactOrganization.findUnique({
      where: {
        contactId_organizationId: { contactId: contact.id, organizationId: secondOrg.id },
      },
    })
    expect(link).not.toBeNull()
    expect(link!.isPrimary).toBe(false)
  })
})

describe('autoAssociateContactToOrg — no matching org', () => {
  it('returns null when no organization has the contact domain', async () => {
    await createOrg(workspaceId, 'Other Corp', ['other.com'])
    const contact = await createContact(workspaceId, 'user@nomatch.com')

    const result = await prisma.$transaction((tx) =>
      autoAssociateContactToOrg(tx, workspaceId, contact),
    )

    expect(result).toBeNull()
  })

  it('does not create any ContactOrganization row when no match', async () => {
    const contact = await createContact(workspaceId, 'user@nomatch.com')

    await prisma.$transaction((tx) =>
      autoAssociateContactToOrg(tx, workspaceId, contact),
    )

    const count = await prisma.contactOrganization.count({
      where: { contactId: contact.id },
    })
    expect(count).toBe(0)
  })

  it('returns null when workspace has no organizations at all', async () => {
    const contact = await createContact(workspaceId, 'user@acme.com')

    const result = await prisma.$transaction((tx) =>
      autoAssociateContactToOrg(tx, workspaceId, contact),
    )

    expect(result).toBeNull()
  })
})

describe('autoAssociateContactToOrg — idempotency', () => {
  it('does not create a duplicate link on a second call for the same contact+org', async () => {
    const org = await createOrg(workspaceId, 'Acme Corp', ['acme.com'])
    const contact = await createContact(workspaceId, 'repeat@acme.com')

    await prisma.$transaction((tx) =>
      autoAssociateContactToOrg(tx, workspaceId, contact),
    )
    // Second call — must not throw a unique constraint violation
    await prisma.$transaction((tx) =>
      autoAssociateContactToOrg(tx, workspaceId, contact),
    )

    const count = await prisma.contactOrganization.count({
      where: { contactId: contact.id, organizationId: org.id },
    })
    expect(count).toBe(1)
  })
})
