import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { prisma } from '@/lib/db'

/**
 * Internal endpoint — provisions a workspace in the OSS app database.
 * Called by helpnest-cloud after a user signs up on the cloud dashboard.
 *
 * POST /api/internal/provision-workspace
 * Headers: x-internal-secret
 * Body: { workspaceSlug, workspaceName, ownerEmail, ownerName }
 *
 * Creates Workspace + User (if not exists) + Member (OWNER) records.
 * Idempotent — safe to call multiple times for the same slug.
 */
export async function POST(request: Request) {
  // Verify internal secret — always required, never skip
  const configuredSecret = process.env.INTERNAL_SECRET
  if (!configuredSecret) {
    return NextResponse.json({ error: 'Internal provisioning not configured' }, { status: 503 })
  }
  const provided = request.headers.get('x-internal-secret')
  if (!provided) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const a = Buffer.from(provided)
  const b = Buffer.from(configuredSecret)
  const valid = a.length === b.length && timingSafeEqual(a, b)
  if (!valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json()) as {
    workspaceId?: string
    workspaceSlug?: string
    workspaceName?: string
    ownerEmail?: string
    ownerName?: string
  }

  if (!body.workspaceSlug || !body.ownerEmail) {
    return NextResponse.json(
      { error: 'workspaceSlug and ownerEmail are required' },
      { status: 400 },
    )
  }

  // Idempotent — if workspace already exists, just return success
  const existing = await prisma.workspace.findUnique({
    where: { slug: body.workspaceSlug },
  })
  if (existing) {
    return NextResponse.json({ ok: true, workspaceId: existing.id })
  }

  // Upsert the user (they may already exist from a previous signup attempt)
  const user = await prisma.user.upsert({
    where: { email: body.ownerEmail },
    update: {},
    create: {
      email: body.ownerEmail,
      name: body.ownerName ?? null,
      // Cloud users authenticate via JWT bridge — no password needed in OSS DB.
      // null passwordHash means credentials login is disabled for this user.
      passwordHash: null,
    },
  })

  // Use the cloud workspace ID if provided, so both DBs reference the same ID
  const workspace = await prisma.workspace.create({
    data: {
      ...(body.workspaceId ? { id: body.workspaceId } : {}),
      name: body.workspaceName ?? `${body.ownerName ?? 'My'} Help Center`,
      slug: body.workspaceSlug,
    },
  })

  await prisma.member.create({
    data: {
      userId: user.id,
      workspaceId: workspace.id,
      role: 'OWNER',
    },
  })

  return NextResponse.json({ ok: true, workspaceId: workspace.id })
}
