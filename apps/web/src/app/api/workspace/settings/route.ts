import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { themes } from '@/lib/themes'
import { NextResponse } from 'next/server'

export async function PATCH(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { name, slug, customDomain, themeId } = body

  // Validate themeId if provided
  if (themeId && !themes.find((t) => t.id === themeId)) {
    return NextResponse.json({ error: 'Invalid theme' }, { status: 400 })
  }

  // Find the workspace the current user owns/admins
  const member = await prisma.member.findFirst({
    where: {
      user: { email: session.user.email! },
      role: { in: ['OWNER', 'ADMIN'] },
    },
    include: { workspace: true },
  })

  if (!member) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const updated = await prisma.workspace.update({
    where: { id: member.workspaceId },
    data: {
      ...(name && { name }),
      ...(slug && { slug }),
      ...(customDomain !== undefined && { customDomain: customDomain || null }),
      ...(themeId && { themeId }),
    },
  })

  return NextResponse.json(updated)
}
