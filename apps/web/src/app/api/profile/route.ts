import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { auth, resolveSessionUserId } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { isDemoMode } from '@/lib/demo'

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

  const { name, currentPassword, newPassword } = body as {
    name?: unknown
    currentPassword?: unknown
    newPassword?: unknown
  }

  if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
    return NextResponse.json({ error: 'Name must be a non-empty string' }, { status: 400 })
  }

  const updates: { name?: string; passwordHash?: string } = {}

  if (typeof name === 'string' && name.trim().length > 0) {
    updates.name = name.trim()
  }

  if (isDemoMode() && (name !== undefined || newPassword !== undefined)) {
    return NextResponse.json({ error: 'Profile changes are disabled in demo mode.' }, { status: 403 })
  }

  if (newPassword !== undefined) {
    if (typeof newPassword !== 'string' || newPassword.length < 12) {
      return NextResponse.json(
        { error: 'New password must be at least 12 characters' },
        { status: 400 },
      )
    }

    // Fetch current user to check existing passwordHash
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (user.passwordHash) {
      // Existing password must be verified before changing it
      if (typeof currentPassword !== 'string' || !currentPassword) {
        return NextResponse.json(
          { error: 'Current password is required to set a new password' },
          { status: 400 },
        )
      }
      const valid = await bcrypt.compare(currentPassword, user.passwordHash)
      if (!valid) {
        return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })
      }
    }
    // If no passwordHash yet, allow first-time password set without current password

    updates.passwordHash = await bcrypt.hash(newPassword, 12)
    ;(updates as Record<string, unknown>).passwordChangedAt = new Date()
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No changes provided' }, { status: 400 })
  }

  try {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: updates,
      select: { id: true, email: true, name: true },
    })
    return NextResponse.json({ user: updated })
  } catch {
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }
}
