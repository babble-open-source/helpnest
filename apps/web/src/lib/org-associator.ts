import type { Contact, Organization, Prisma } from '@helpnest/db'
import { FREE_MAIL_DOMAINS } from './free-mail-domains'

/**
 * Attempts to associate a Contact with an Organization based on the email domain.
 *
 * Algorithm (spec §5):
 *  1. Extract domain from contact.email. Return null if email is null or malformed.
 *  2. Skip free/consumer email domains (FREE_MAIL_DOMAINS set). Return null.
 *  3. Query Organization rows in the same workspace whose `domains` array contains
 *     the extracted domain. If none found, return null.
 *  4. If multiple orgs match the same domain, pick the first alphabetically by name
 *     (Zendesk rule — deterministic, reproducible).
 *  5. Determine isPrimary: true if the contact has no existing ContactOrganization
 *     rows yet (checked inside the transaction); false otherwise.
 *  6. Upsert the ContactOrganization link (source: DOMAIN). In-place update on
 *     conflict — never delete+insert (spec critique O2). isPrimary is only set to
 *     true here; if a primary link already exists it stays intact.
 *  7. Return the matched Organization.
 *
 * All reads and writes use the supplied transaction client so callers can compose
 * this inside a prisma.$transaction alongside conversation creation.
 *
 * @param tx          Prisma transaction client
 * @param workspaceId Workspace scope
 * @param contact     The Contact to associate (must already be persisted)
 * @returns           The matched Organization, or null if no association was made
 */
export async function autoAssociateContactToOrg(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  contact: Contact
): Promise<Organization | null> {
  const domain = extractDomain(contact.email)
  if (domain === null) return null

  if (FREE_MAIL_DOMAINS.has(domain)) return null

  // Find all organizations in the workspace that list this domain
  const matchingOrgs = await tx.organization.findMany({
    where: {
      workspaceId,
      domains: { has: domain },
    },
    orderBy: { name: 'asc' },
  })

  if (matchingOrgs.length === 0) return null

  // First alphabetically by name — deterministic when multiple orgs share a domain.
  // The length guard above ensures at least one element; the non-null assertion is safe.
  const targetOrg = matchingOrgs[0]!

  // Determine isPrimary: true only when the contact has no org memberships yet
  const existingLinkCount = await tx.contactOrganization.count({
    where: { contactId: contact.id },
  })
  const isPrimary = existingLinkCount === 0

  // Upsert: create if absent, update source/isPrimary in-place on conflict.
  // We only promote to primary (true → false transition never happens here; that
  // would require a separate explicit "set-primary" action).
  await tx.contactOrganization.upsert({
    where: {
      contactId_organizationId: {
        contactId: contact.id,
        organizationId: targetOrg.id,
      },
    },
    create: {
      workspaceId,
      contactId: contact.id,
      organizationId: targetOrg.id,
      source: 'DOMAIN',
      isPrimary,
    },
    update: {
      source: 'DOMAIN',
      // Only set isPrimary to true; never demote an existing primary link to false
      // by overwriting — the create-time isPrimary value is the authoritative one.
      ...(isPrimary ? { isPrimary: true } : {}),
    },
  })

  return targetOrg as Organization
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Extracts the lowercase domain portion of an email address.
 * Returns null if the input is null, empty, or does not contain an '@' after
 * the first character (i.e. bare strings like "nodomain" return null).
 */
function extractDomain(email: string | null | undefined): string | null {
  if (!email) return null

  const atIndex = email.lastIndexOf('@')
  if (atIndex <= 0) return null

  const domain = email
    .slice(atIndex + 1)
    .toLowerCase()
    .trim()
  if (domain.length === 0) return null

  return domain
}
