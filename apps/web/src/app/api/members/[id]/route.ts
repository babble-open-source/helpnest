import { NextResponse } from 'next/server'
import { auth, resolveSessionUserId } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { isDemoMode } from '@/lib/demo'
type MemberRole = 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER'

const VALID_ROLES: MemberRole[] = ['OWNER', 'ADMIN', 'EDITOR', 'VIEWER']

/** Lower number = higher privilege. */
const ROLE_RANK: Record<MemberRole, number> = { OWNER: 0, ADMIN: 1, EDITOR: 2, VIEWER: 3 }

function outranks(callerRole: MemberRole, targetRole: MemberRole): boolean {
  return ROLE_RANK[callerRole] < ROLE_RANK[targetRole]
}

async function resolveCallerMember(userId: string, workspaceId: string) {
  return prisma.member.findFirst({
    where: {
      userId,
      workspaceId,
      role: { in: ['OWNER', 'ADMIN'] },
      deactivatedAt: null,
    },
  })
}

async function countActiveOwners(workspaceId: string) {
  return prisma.member.count({
    where: { workspaceId, role: 'OWNER', deactivatedAt: null },
  })
}

export async function PATCH(
  request: Request,
  { params: paramsPromise }: { params: Promise<{ id: string }> },
) {
  const [session, params] = await Promise.all([auth(), paramsPromise])
  const userId = await resolveSessionUserId(session)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (isDemoMode()) {
    return NextResponse.json({ error: 'Member management is disabled in demo mode.' }, { status: 403 })
  }

  const target = await prisma.member.findUnique({
    where: { id: params.id },
  })

  if (!target) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  }

  // Resolve caller in the same workspace as the target
  const callerMember = await resolveCallerMember(userId, target.workspaceId)
  if (!callerMember) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Callers can only manage members with strictly lower privilege
  if (!outranks(callerMember.role as MemberRole, target.role as MemberRole)) {
    return NextResponse.json({ error: 'Cannot modify a member with equal or higher privilege' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { role, deactivatedAt } = body as { role?: unknown; deactivatedAt?: unknown }

  const updates: { role?: MemberRole; deactivatedAt?: Date | null } = {}

  if (role !== undefined) {
    if (typeof role !== 'string' || !VALID_ROLES.includes(role as MemberRole)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }
    // Callers cannot promote to their own level or above
    if (ROLE_RANK[role as MemberRole] <= ROLE_RANK[callerMember.role as MemberRole]) {
      return NextResponse.json({ error: 'Cannot assign a role equal to or above your own' }, { status: 403 })
    }
    // Prevent demoting the last OWNER
    if (target.role === 'OWNER' && role !== 'OWNER') {
      const ownerCount = await countActiveOwners(target.workspaceId)
      if (ownerCount <= 1) {
        return NextResponse.json(
          { error: 'Cannot demote the last owner of the workspace' },
          { status: 400 },
        )
      }
    }
    updates.role = role as MemberRole
  }

  if ('deactivatedAt' in (body as object)) {
    if (deactivatedAt === null) {
      updates.deactivatedAt = null
    } else if (typeof deactivatedAt === 'string') {
      const parsed = new Date(deactivatedAt)
      if (isNaN(parsed.getTime())) {
        return NextResponse.json({ error: 'Invalid deactivatedAt date' }, { status: 400 })
      }
      // Prevent deactivating the last OWNER
      if (target.role === 'OWNER') {
        const ownerCount = await countActiveOwners(target.workspaceId)
        if (ownerCount <= 1) {
          return NextResponse.json(
            { error: 'Cannot deactivate the last owner of the workspace' },
            { status: 400 },
          )
        }
      }
      updates.deactivatedAt = parsed
    } else {
      return NextResponse.json({ error: 'Invalid deactivatedAt value' }, { status: 400 })
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No changes provided' }, { status: 400 })
  }

  const updated = await prisma.member.update({
    where: { id: params.id },
    data: updates,
    include: { user: { select: { id: true, email: true, name: true } } },
  })

  return NextResponse.json({ member: updated })
}

export async function DELETE(
  _request: Request,
  { params: paramsPromise }: { params: Promise<{ id: string }> },
) {
  const [session, params] = await Promise.all([auth(), paramsPromise])
  const userId = await resolveSessionUserId(session)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (isDemoMode()) {
    return NextResponse.json({ error: 'Member management is disabled in demo mode.' }, { status: 403 })
  }

  const target = await prisma.member.findUnique({
    where: { id: params.id },
  })

  if (!target) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  }

  // Resolve caller in the same workspace as the target
  const callerMember = await resolveCallerMember(userId, target.workspaceId)
  if (!callerMember) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Callers can only remove members with strictly lower privilege
  if (!outranks(callerMember.role as MemberRole, target.role as MemberRole)) {
    return NextResponse.json({ error: 'Cannot remove a member with equal or higher privilege' }, { status: 403 })
  }

  // Prevent deleting the last OWNER
  if (target.role === 'OWNER') {
    const ownerCount = await countActiveOwners(target.workspaceId)
    if (ownerCount <= 1) {
      return NextResponse.json(
        { error: 'Cannot remove the last owner of the workspace' },
        { status: 400 },
      )
    }
  }

  await prisma.member.delete({ where: { id: params.id } })

  return new NextResponse(null, { status: 204 })
}
