import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { generateKey, hashKey } from '@/lib/api-key'
import { isDemoMode } from '@/lib/demo'

/** Returns the session member only if they are OWNER or ADMIN. */
async function requireAdminMember(email: string) {
  return prisma.member.findFirst({
    where: {
      user: { email },
      role: { in: ['OWNER', 'ADMIN'] },
    },
    select: { workspaceId: true },
  })
}

/**
 * GET /api/api-keys
 * Lists all API keys for the authenticated user's workspace.
 * Returns id, name, createdAt, lastUsedAt — never the key hash.
 */
export async function GET() {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const member = await prisma.member.findFirst({
    where: { user: { email: session.user.email } },
    select: { workspaceId: true },
  })
  if (!member) {
    return NextResponse.json({ error: 'No workspace' }, { status: 403 })
  }

  const keys = await prisma.apiKey.findMany({
    where: { workspaceId: member.workspaceId },
    select: { id: true, name: true, createdAt: true, lastUsedAt: true },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ keys })
}

/**
 * POST /api/api-keys
 * Creates a new API key. Body: `{ name: string }`.
 * Requires OWNER or ADMIN role.
 * Returns the raw key exactly once — it is never retrievable again.
 */
export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const member = await requireAdminMember(session.user.email)
  if (!member) {
    return NextResponse.json({ error: 'Forbidden — OWNER or ADMIN required' }, { status: 403 })
  }

  if (isDemoMode()) {
    return NextResponse.json({ error: 'API key management is disabled in demo mode.' }, { status: 403 })
  }

  const body = await request.json() as { name?: string }
  const name = body.name?.trim()
  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }
  if (name.length > 100) {
    return NextResponse.json({ error: 'name must be 100 characters or fewer' }, { status: 400 })
  }

  const rawKey = generateKey()
  const keyHash = hashKey(rawKey)

  const apiKey = await prisma.apiKey.create({
    data: {
      workspaceId: member.workspaceId,
      name,
      keyHash,
    },
    select: { id: true, name: true, createdAt: true },
  })

  // The raw key is returned exactly once and never persisted in plaintext.
  return NextResponse.json({ ...apiKey, key: rawKey }, { status: 201 })
}
