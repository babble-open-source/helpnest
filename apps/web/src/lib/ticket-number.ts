import { Prisma } from '@helpnest/db'

/**
 * Atomically allocates the next ticket number for a workspace.
 *
 * Uses a single INSERT … ON CONFLICT … DO UPDATE … RETURNING statement so
 * there is no window between read and write — concurrent callers never
 * receive duplicate or out-of-order numbers.
 *
 * MUST be called inside a Prisma transaction (`tx`). The UPDATE is rolled
 * back with the outer transaction if the surrounding work fails, preventing
 * gaps from accumulating due to application errors.
 *
 * Migration A seeds a WorkspaceCounter row for every existing workspace
 * (lastConversationNumber = current MAX or 0), so the ON CONFLICT path is
 * the normal execution path. The INSERT path handles new workspaces created
 * after Migration A.
 *
 * @param tx           - Prisma transaction client (Prisma.TransactionClient)
 * @param workspaceId  - The workspace to allocate a number for
 * @returns            The newly allocated conversation number (>= 1)
 */
export async function assignConversationNumber(
  tx: Prisma.TransactionClient,
  workspaceId: string
): Promise<number> {
  const rows = await tx.$queryRaw<{ n: number }[]>`
    INSERT INTO "WorkspaceCounter" ("workspaceId", "lastConversationNumber")
    VALUES (${workspaceId}, 1)
    ON CONFLICT ("workspaceId") DO UPDATE
      SET "lastConversationNumber" = "WorkspaceCounter"."lastConversationNumber" + 1
    RETURNING "lastConversationNumber" AS n`

  const row = rows[0]
  if (!row)
    throw new Error(`assignConversationNumber: no row returned for workspaceId=${workspaceId}`)
  return row.n
}
