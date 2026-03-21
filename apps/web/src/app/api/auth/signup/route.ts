import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
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
 * POST /api/auth/signup
 * Creates a new user + workspace. Only available in cloud mode.
 */
export async function POST(request: Request) {
  if (!isCloudMode()) {
    return NextResponse.json({ error: 'Signup is not available in self-hosted mode' }, { status: 403 })
  }

  const { name, email, password } = (await request.json()) as {
    name?: string
    email?: string
    password?: string
  }

  if (!name || !email || !password) {
    return NextResponse.json({ error: 'Name, email, and password are required' }, { status: 400 })
  }

  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 })
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const baseSlug = slugify(name) || 'workspace'

  let slug = baseSlug
  let workspaceId: string | null = null

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const slugTaken = await tx.workspace.findUnique({ where: { slug } })
        if (slugTaken) {
          throw Object.assign(new Error('SLUG_TAKEN'), { code: 'SLUG_TAKEN' })
        }

        const user = await tx.user.create({
          data: { name, email, passwordHash },
        })

        const workspace = await tx.workspace.create({
          data: { name: `${name}'s Help Center`, slug },
        })

        await tx.member.create({
          data: { userId: user.id, workspaceId: workspace.id, role: 'OWNER' },
        })

        return { workspaceId: workspace.id }
      })

      workspaceId = result.workspaceId
      break
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

  // Provision workspace in cloud billing system (fire-and-forget)
  if (workspaceId) {
    provisionWorkspace(workspaceId, email as string, `${name}'s Help Center`, slug)
  }

  return NextResponse.json({ ok: true, workspaceSlug: slug })
}
