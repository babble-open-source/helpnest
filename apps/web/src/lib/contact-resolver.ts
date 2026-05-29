import type { Contact, Prisma } from '@helpnest/db'

export interface ResolveContactInput {
  externalId?: string | null
  email?: string | null
  visitorId?: string | null
  fullName?: string | null
  phone?: string | null
}

/**
 * Resolves an existing Contact or creates a new one within the supplied
 * transaction client.
 *
 * Dedup order (spec §5):
 *   1. externalId  — product/CRM user id; strongest signal, idempotent upsert key
 *   2. email       — primary human-readable dedup key
 *   3. visitorId   — anonymous widget identity pre-identification
 *   4. create      — no match; a new Contact row is inserted
 *
 * When a match is found, fullName and phone are merged in-place (updated on the
 * existing row) only when the caller supplies non-null values — existing values
 * are never overwritten by null/undefined inputs.
 *
 * mergedInto chains: if the resolved contact has mergedIntoId set (it was merged
 * into another contact), this function follows the chain to the survivor before
 * returning. The chain walk terminates as soon as a contact with no mergedIntoId
 * is found. Infinite cycles are guarded by a depth limit of 10.
 *
 * @param tx          Prisma transaction client (or bare prisma for non-transactional use)
 * @param workspaceId Workspace scope — all lookups and inserts are scoped to this
 * @param input       Identity signals from the caller
 * @returns           The resolved or newly created Contact (always the merge survivor)
 */
export async function resolveOrCreateContact(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  input: ResolveContactInput
): Promise<Contact> {
  const contact = await findExistingContact(tx, workspaceId, input)

  if (contact !== null) {
    const merged = await updateContactFields(tx, contact, input)
    return followMergeChain(tx, merged)
  }

  const created = await tx.contact.create({
    data: {
      workspaceId,
      externalId: input.externalId ?? null,
      email: input.email ?? null,
      visitorId: input.visitorId ?? null,
      fullName: input.fullName ?? null,
      phone: input.phone ?? null,
    },
  })

  return created
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function findExistingContact(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  input: ResolveContactInput
): Promise<Contact | null> {
  // Priority 1: externalId
  if (input.externalId != null) {
    const found = await tx.contact.findUnique({
      where: { workspaceId_externalId: { workspaceId, externalId: input.externalId } },
    })
    if (found !== null) return found
  }

  // Priority 2: email
  if (input.email != null) {
    const found = await tx.contact.findUnique({
      where: { workspaceId_email: { workspaceId, email: input.email } },
    })
    if (found !== null) return found
  }

  // Priority 3: visitorId
  if (input.visitorId != null) {
    const found = await tx.contact.findUnique({
      where: { workspaceId_visitorId: { workspaceId, visitorId: input.visitorId } },
    })
    if (found !== null) return found
  }

  return null
}

/**
 * Merges non-null fullName and phone from input onto the contact row in place.
 * Returns the (possibly updated) contact.
 */
async function updateContactFields(
  tx: Prisma.TransactionClient,
  contact: Contact,
  input: ResolveContactInput
): Promise<Contact> {
  const patch: { fullName?: string; phone?: string } = {}

  if (input.fullName != null) patch.fullName = input.fullName
  if (input.phone != null) patch.phone = input.phone

  if (Object.keys(patch).length === 0) return contact

  return tx.contact.update({
    where: { id: contact.id },
    data: patch,
  })
}

/**
 * Walks the mergedInto chain until a contact with no mergedIntoId is found.
 * Guards against malformed cycles with a depth limit of 10.
 */
async function followMergeChain(
  tx: Prisma.TransactionClient,
  contact: Contact,
  depth = 0
): Promise<Contact> {
  const MAX_DEPTH = 10

  if (contact.mergedIntoId == null || depth >= MAX_DEPTH) {
    return contact
  }

  const survivor = await tx.contact.findUnique({
    where: { id: contact.mergedIntoId },
  })

  if (survivor === null) {
    // Dangling FK — mergedInto target was deleted; return current contact as best effort
    return contact
  }

  return followMergeChain(tx, survivor, depth + 1)
}
