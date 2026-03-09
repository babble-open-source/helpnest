import { auth, resolveSessionUserId } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Prisma } from '@helpnest/db'
import { themes } from '@/lib/themes'
import { NextResponse } from 'next/server'

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export async function PATCH(request: Request) {
  const session = await auth()
  const userId = await resolveSessionUserId(session)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

  const { name, slug, customDomain, themeId } = body as {
    name?: unknown
    slug?: unknown
    customDomain?: unknown
    themeId?: unknown
  }

  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name must be a non-empty string' }, { status: 400 })
    }
    if (name.trim().length > 100) {
      return NextResponse.json({ error: 'Name must be 100 characters or fewer' }, { status: 400 })
    }
  }

  if (slug !== undefined) {
    if (typeof slug !== 'string' || !SLUG_RE.test(slug) || slug.length > 63) {
      return NextResponse.json(
        { error: 'Slug must be lowercase alphanumeric with hyphens, max 63 characters' },
        { status: 400 },
      )
    }
  }

  if (themeId !== undefined && typeof themeId === 'string') {
    if (!themes.find((t) => t.id === themeId)) {
      return NextResponse.json({ error: 'Invalid theme' }, { status: 400 })
    }
  }

  // Find the workspace the current user owns/admins
  const member = await prisma.member.findFirst({
    where: {
      userId,
      role: { in: ['OWNER', 'ADMIN'] },
    },
    include: { workspace: true },
  })

  if (!member) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const updated = await prisma.workspace.update({
      where: { id: member.workspaceId },
      data: {
        ...(name ? { name: (name as string).trim() } : {}),
        ...(slug ? { slug: slug as string } : {}),
        ...(customDomain !== undefined ? { customDomain: (customDomain as string | null) || null } : {}),
        ...(themeId ? { themeId: themeId as string } : {}),
      },
    })
    return NextResponse.json(updated)
  } catch (e: unknown) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return NextResponse.json({ error: 'This slug is already taken' }, { status: 409 })
    }
    throw e
  }
}
