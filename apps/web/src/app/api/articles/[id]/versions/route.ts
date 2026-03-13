import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'

export async function GET(
  _req: Request,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const [session, params] = await Promise.all([auth(), paramsPromise])
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
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const [session, params] = await Promise.all([auth(), paramsPromise])
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

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const { title, content } = body as { title?: unknown; content?: unknown }
  if (typeof title !== 'string' || title.trim().length === 0) {
    return NextResponse.json({ error: 'title must be a non-empty string' }, { status: 400 })
  }
  if (typeof content !== 'string') {
    return NextResponse.json({ error: 'content must be a string' }, { status: 400 })
  }

  // Use a transaction to atomically read the last version number and create the new one,
  // preventing duplicate version numbers from concurrent requests.
  const version = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const last = await tx.articleVersion.findFirst({
      where: { articleId: params.id },
      orderBy: { version: 'desc' },
      select: { version: true },
    })
    return tx.articleVersion.create({
      data: {
        articleId: params.id,
        authorId: member.userId,
        title: title.trim(),
        content,
        version: (last?.version ?? 0) + 1,
      },
    })
  })

  return NextResponse.json(version)
}
