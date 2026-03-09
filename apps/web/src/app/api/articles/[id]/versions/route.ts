import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify article belongs to a workspace the caller is a member of
  const member = await prisma.member.findFirst({
    where: { user: { email: session.user.email! } },
    select: { workspaceId: true },
  })
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const article = await prisma.article.findFirst({
    where: { id: params.id, workspaceId: member.workspaceId },
    select: { id: true },
  })
  if (!article) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const versions = await prisma.articleVersion.findMany({
    where: { articleId: params.id },
    orderBy: { version: 'desc' },
    include: { author: { select: { name: true, email: true } } },
  })

  return NextResponse.json(versions)
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const member = await prisma.member.findFirst({
    where: { user: { email: session.user.email! } },
    select: { workspaceId: true, userId: true },
  })
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Verify article belongs to the caller's workspace
  const article = await prisma.article.findFirst({
    where: { id: params.id, workspaceId: member.workspaceId },
    select: { id: true },
  })
  if (!article) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { title, content } = await request.json() as { title: string; content: string }

  const last = await prisma.articleVersion.findFirst({
    where: { articleId: params.id },
    orderBy: { version: 'desc' },
    select: { version: true },
  })

  const version = await prisma.articleVersion.create({
    data: {
      articleId: params.id,
      authorId: member.userId,
      title,
      content,
      version: (last?.version ?? 0) + 1,
    },
  })

  return NextResponse.json(version)
}
