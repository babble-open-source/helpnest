import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

async function getMember(email: string) {
  return prisma.member.findFirst({
    where: {
      user: { email },
      role: { in: ['OWNER', 'ADMIN', 'EDITOR'] },
    },
    select: { workspaceId: true },
  })
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const member = await getMember(session.user.email!)
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const col = await prisma.collection.findFirst({
    where: { id: params.id, workspaceId: member.workspaceId },
    select: { id: true, slug: true },
  })
  if (!col) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json() as {
    title?: string
    description?: string
    emoji?: string
    isPublic?: boolean
  }

  const updated = await prisma.collection.update({
    where: { id: params.id },
    data: {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.description !== undefined && { description: body.description || null }),
      ...(body.emoji !== undefined && { emoji: body.emoji }),
      ...(body.isPublic !== undefined && { isPublic: body.isPublic }),
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const member = await getMember(session.user.email!)
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const col = await prisma.collection.findFirst({
    where: { id: params.id, workspaceId: member.workspaceId },
    select: { id: true, _count: { select: { articles: true } } },
  })
  if (!col) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (col._count.articles > 0) {
    return NextResponse.json(
      { error: `Cannot delete — this collection has ${col._count.articles} article${col._count.articles !== 1 ? 's' : ''}. Move or delete them first.` },
      { status: 409 }
    )
  }

  await prisma.collection.delete({ where: { id: params.id } })

  return new NextResponse(null, { status: 204 })
}
