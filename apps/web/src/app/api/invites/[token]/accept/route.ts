import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'

export async function POST(
  request: Request,
  { params }: { params: { token: string } },
) {
  const { token } = params

  if (!token) {
    return NextResponse.json({ error: 'Token is required' }, { status: 400 })
  }

  const invite = await prisma.invite.findUnique({
    where: { token },
    include: { workspace: { select: { id: true } } },
  })

  if (!invite) {
    return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
  }

  if (invite.acceptedAt) {
    return NextResponse.json({ error: 'This invite has already been accepted' }, { status: 410 })
  }

  if (invite.expiresAt < new Date()) {
    return NextResponse.json({ error: 'This invite has expired' }, { status: 410 })
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

  const { name, password } = body as { name?: unknown; password?: unknown }

  if (typeof name !== 'string' || name.trim().length === 0) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }

  if (typeof password !== 'string' || password.length < 8) {
    return NextResponse.json(
      { error: 'Password must be at least 8 characters' },
      { status: 400 },
    )
  }

  const passwordHash = await bcrypt.hash(password, 12)

  // Use a transaction so user creation, member creation, and invite update are atomic
  await prisma.$transaction(async (tx) => {
    // Upsert user: create if new, update name/password if existing
    const user = await tx.user.upsert({
      where: { email: invite.email },
      create: {
        email: invite.email,
        name: name.trim(),
        passwordHash,
      },
      update: {
        name: name.trim(),
        passwordHash,
      },
      select: { id: true },
    })

    // Upsert member: in case they were previously deactivated, reactivate them
    await tx.member.upsert({
      where: {
        workspaceId_userId: {
          workspaceId: invite.workspaceId,
          userId: user.id,
        },
      },
      create: {
        workspaceId: invite.workspaceId,
        userId: user.id,
        role: invite.role,
        deactivatedAt: null,
      },
      update: {
        role: invite.role,
        deactivatedAt: null,
      },
    })

    // Mark invite as accepted
    await tx.invite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    })
  })

  return NextResponse.json({ ok: true })
}
