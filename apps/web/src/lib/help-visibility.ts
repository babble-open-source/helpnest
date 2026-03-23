import type { CollectionVisibility } from '@helpnest/db'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth-api'

/**
 * Determines which collection visibility levels the current user can see
 * on help center pages (Server Components).
 *
 * - Authenticated workspace members see PUBLIC + INTERNAL.
 * - Everyone else sees PUBLIC only.
 */
export async function getHelpCenterVisibility(
  workspaceId: string,
): Promise<CollectionVisibility[]> {
  const session = await auth()
  if (!session?.user?.id) return ['PUBLIC']

  const member = await prisma.member.findFirst({
    where: { userId: session.user.id, workspaceId, deactivatedAt: null },
    select: { id: true },
  })

  return member ? ['PUBLIC', 'INTERNAL'] : ['PUBLIC']
}

/**
 * Determines visibility for API routes. Accepts a Request so it can check
 * both Bearer tokens and session cookies. Non-throwing — returns PUBLIC-only
 * on auth failure (safe for public endpoints with optional auth).
 */
export async function getApiVisibility(
  request: Request,
  workspaceId: string,
): Promise<CollectionVisibility[]> {
  try {
    const authResult = await requireAuth(request)
    if (authResult && authResult.workspaceId === workspaceId) {
      return ['PUBLIC', 'INTERNAL']
    }
  } catch {
    // Auth failure — fall through to public-only
  }
  return ['PUBLIC']
}

