import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { auth, resolveSessionUserId } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { isCloudMode, provisionWorkspace, getWorkspacePlan } from '@/lib/cloud'

function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 7)
}

/**
 * Workspace limits per plan (cloud mode only).
 * Self-hosted has no limit.
 */
const WORKSPACE_LIMITS: Record<string, number> = {
  FREE: 1,
  PRO: 1,
  BUSINESS: 3,
}

/**
 * POST /api/workspaces/create
 * Creates a new workspace for the current user.
 * In cloud mode, limited by plan tier.
 * Body: { name }
 */
export async function POST(request: Request) {
  const session = await auth()
  const userId = await resolveSessionUserId(session)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { name, slug: requestedSlug } = (await request.json()) as { name?: string; slug?: string }
  if (!name?.trim()) {
    return NextResponse.json({ error: 'Workspace name is required' }, { status: 400 })
  }

  // In cloud mode, check workspace limit based on plan of primary OWNED workspace
  let planTier = 'FREE'
  if (isCloudMode()) {
    const allOwned = await prisma.member.findMany({
      where: { userId, role: 'OWNER', deactivatedAt: null },
      select: { workspaceId: true, workspace: { select: { deletedAt: true } } },
      orderBy: { id: 'asc' },
    })
    // Exclude soft-deleted workspaces from the count
    const ownedWorkspaces = allOwned.filter((m) => m.workspace.deletedAt === null)

    let cloudReachable = true
    if (ownedWorkspaces.length > 0 && ownedWorkspaces[0]) {
      const plan = await getWorkspacePlan(ownedWorkspaces[0].workspaceId)
      if (plan) {
        planTier = plan.plan ?? 'FREE'
      } else {
        // Cloud unreachable — fail open (consistent with checkLimit behavior)
        cloudReachable = false
      }
    }

    // Only enforce limits when cloud is reachable
    if (cloudReachable) {
      const limit = WORKSPACE_LIMITS[planTier] ?? 1
      if (ownedWorkspaces.length >= limit) {
        return NextResponse.json(
          { error: `Your ${planTier} plan allows up to ${limit} workspace${limit === 1 ? '' : 's'}. Upgrade to create more.` },
          { status: 403 },
        )
      }
    }
  }

  const RESERVED_SLUGS = new Set([
    'api', 'admin', 'dashboard', 'login', 'logout', 'signup', 'onboarding',
    'invite', 'settings', 'billing', 'help', 'www', 'mail', 'support',
    'status', 'health', 'static', 'assets', '_next', 'imports', 'widget',
  ])

  const trimmedName = name.trim()
  const baseSlug = requestedSlug?.trim() ? slugify(requestedSlug.trim()) : (slugify(trimmedName) || 'workspace')

  if (!baseSlug || baseSlug.length < 3) {
    return NextResponse.json({ error: 'Slug must be at least 3 characters.' }, { status: 400 })
  }

  if (RESERVED_SLUGS.has(baseSlug)) {
    return NextResponse.json({ error: 'That URL is reserved. Please choose a different one.' }, { status: 400 })
  }

  let slug = baseSlug

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const workspace = await prisma.$transaction(async (tx) => {
        // Re-check ownership count inside transaction to prevent race conditions
        if (isCloudMode()) {
          const ownedMembers = await tx.member.findMany({
            where: { userId, role: 'OWNER', deactivatedAt: null },
            select: { workspace: { select: { deletedAt: true } } },
          })
          const ownedCount = ownedMembers.filter((m) => m.workspace.deletedAt === null).length
          // Use the limit from the outer check (already validated against plan)
          const limit = WORKSPACE_LIMITS[planTier] ?? 1
          if (ownedCount >= limit) {
            throw Object.assign(new Error('LIMIT_EXCEEDED'), { code: 'LIMIT_EXCEEDED' })
          }
        }

        const slugTaken = await tx.workspace.findUnique({ where: { slug } })
        if (slugTaken) {
          throw Object.assign(new Error('SLUG_TAKEN'), { code: 'SLUG_TAKEN' })
        }

        const ws = await tx.workspace.create({
          data: { name: trimmedName, slug },
        })

        await tx.member.create({
          data: { userId, workspaceId: ws.id, role: 'OWNER' },
        })

        return ws
      })

      // Set as active workspace
      const cookieStore = await cookies()
      cookieStore.set('helpnest-workspace', workspace.id, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 365 * 24 * 60 * 60,
      })

      // Provision in cloud billing (fire-and-forget)
      if (isCloudMode() && session?.user?.email) {
        provisionWorkspace(workspace.id)
      }

      return NextResponse.json({
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
      }, { status: 201 })
    } catch (err) {
      if ((err as { code?: string }).code === 'LIMIT_EXCEEDED') {
        return NextResponse.json(
          { error: `Workspace limit reached. Upgrade your plan to create more.` },
          { status: 403 },
        )
      }

      const isSlugConflict =
        (err as { code?: string }).code === 'SLUG_TAKEN' ||
        (err as { code?: string }).code === 'P2002'

      if (isSlugConflict && attempt < 4) {
        slug = `${baseSlug}-${randomSuffix()}`
        continue
      }
      throw err
    }
  }

  return NextResponse.json({ error: 'Failed to create workspace' }, { status: 500 })
}
