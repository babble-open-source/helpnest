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
    where: { userId, deactivatedAt: null },
    select: {
      workspaceId: true,
      role: true,
      workspace: {
        select: { id: true, name: true, slug: true, logo: true, deletedAt: true },
      },
    },
    orderBy: { workspace: { name: 'asc' } },
  })

  return members
    .filter((m) => m.workspace.deletedAt === null)
    .map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      slug: m.workspace.slug,
      logo: m.workspace.logo,
      role: m.role,
    }))
}

/**
 * Get all workspaces the user belongs to, split by active/deleted.
 * Used by the /workspaces hub page.
 */
export async function getAllUserWorkspaces(userId: string) {
  const members = await prisma.member.findMany({
    where: { userId, deactivatedAt: null },
    include: {
      workspace: {
        select: { id: true, name: true, slug: true, logo: true, deletedAt: true },
      },
    },
    orderBy: { workspace: { name: 'asc' } },
  })

  const active: Array<{
    id: string; name: string; slug: string; logo: string | null;
    role: string; deletedAt: null
  }> = []
  const deleted: Array<{
    id: string; name: string; slug: string; logo: string | null;
    role: string; deletedAt: Date
  }> = []

  for (const m of members) {
    const entry = {
      id: m.workspace.id,
      name: m.workspace.name,
      slug: m.workspace.slug,
      logo: m.workspace.logo,
      role: m.role,
      deletedAt: m.workspace.deletedAt,
    }
    if (m.workspace.deletedAt === null) {
      active.push({ ...entry, deletedAt: null })
    } else {
      deleted.push({ ...entry, deletedAt: m.workspace.deletedAt })
    }
  }

  deleted.sort((a, b) => b.deletedAt.getTime() - a.deletedAt.getTime())
  return { active, deleted }
}
