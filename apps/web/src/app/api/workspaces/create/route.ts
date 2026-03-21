import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { auth, resolveSessionUserId } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { isCloudMode, provisionWorkspace } from '@/lib/cloud'

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
  PRO: 3,
  BUSINESS: 10,
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

  const { name } = (await request.json()) as { name?: string }
  if (!name?.trim()) {
    return NextResponse.json({ error: 'Workspace name is required' }, { status: 400 })
  }

  // In cloud mode, check workspace limit based on plan
  if (isCloudMode()) {
    const existingWorkspaces = await prisma.member.findMany({
      where: { userId, role: 'OWNER', deactivatedAt: null },
      select: { workspaceId: true },
    })

    // Get the plan of the user's first (primary) workspace to determine limit
    const primaryMember = await prisma.member.findFirst({
      where: { userId, deactivatedAt: null },
      select: { workspaceId: true },
      orderBy: { id: 'asc' },
    })

    let planTier = 'FREE'
    if (primaryMember) {
      try {
        const cloudUrl = process.env.CLOUD_API_URL
        const secret = process.env.INTERNAL_SECRET
        if (cloudUrl && secret) {
          const res = await fetch(`${cloudUrl}/api/workspaces/${primaryMember.workspaceId}/plan`, {
            headers: { 'x-internal-secret': secret },
          })
          if (res.ok) {
            const data = await res.json()
            planTier = data.plan ?? 'FREE'
          }
        }
      } catch {
        // If cloud is unreachable, use FREE limit
      }
    }

    const limit = WORKSPACE_LIMITS[planTier] ?? 1
    if (existingWorkspaces.length >= limit) {
      return NextResponse.json(
        { error: `Your ${planTier} plan allows up to ${limit} workspace${limit === 1 ? '' : 's'}. Upgrade to create more.` },
        { status: 403 },
      )
    }
  }

  const trimmedName = name.trim()
  const baseSlug = slugify(trimmedName) || 'workspace'
  let slug = baseSlug

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const workspace = await prisma.$transaction(async (tx) => {
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
        provisionWorkspace(workspace.id, session.user.email, trimmedName, slug)
      }

      return NextResponse.json({
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
      }, { status: 201 })
    } catch (err) {
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
