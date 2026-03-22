import { cache } from 'react'
import { cookies } from 'next/headers'
import { prisma } from './db'

const WORKSPACE_COOKIE = 'helpnest-workspace'

/**
 * Resolve the active workspace for the current user.
 *
 * Priority:
 * 1. Cookie `helpnest-workspace` (if set and user is still a member)
 * 2. First active member record (fallback)
 *
 * Returns null if the user has no workspaces.
 *
 * Wrapped with React `cache()` so multiple Server Components in the same
 * render pass (layout + page) share one result — no extra DB round-trip.
 */
export const resolveWorkspaceId = cache(async function resolveWorkspaceId(userId: string): Promise<string | null> {
  const cookieStore = await cookies()
  const preferred = cookieStore.get(WORKSPACE_COOKIE)?.value

  if (preferred) {
    // Verify the user is still an active member of this workspace
    const member = await prisma.member.findFirst({
      where: { userId, workspaceId: preferred, deactivatedAt: null, workspace: { deletedAt: null } },
      select: { workspaceId: true },
    })
    if (member) return member.workspaceId
  }

  // Fallback: first active workspace (deterministic order)
  const member = await prisma.member.findFirst({
    where: { userId, deactivatedAt: null, workspace: { deletedAt: null } },
    select: { workspaceId: true },
    orderBy: { id: 'asc' },
  })
  return member?.workspaceId ?? null
})

/**
 * Get all workspaces the user belongs to.
 */
export async function getUserWorkspaces(userId: string) {
  const members = await prisma.member.findMany({
    where: { userId, deactivatedAt: null, workspace: { deletedAt: null } },
    select: {
      workspaceId: true,
      role: true,
      workspace: {
        select: { id: true, name: true, slug: true, logo: true },
      },
    },
    orderBy: { workspace: { name: 'asc' } },
  })

  return members.map((m) => ({
    id: m.workspace.id,
    name: m.workspace.name,
    slug: m.workspace.slug,
    logo: m.workspace.logo,
    role: m.role,
  }))
}
