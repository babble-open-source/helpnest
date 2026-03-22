import { NextResponse } from 'next/server'
import { auth, resolveSessionUserId } from '@/lib/auth'
import { Prisma } from '@helpnest/db'
import { prisma } from '@/lib/db'
import { resolveWorkspaceId } from '@/lib/workspace'

export async function GET(
  _req: Request,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const [session, params] = await Promise.all([auth(), paramsPromise])
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = await resolveSessionUserId(session)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspaceId = await resolveWorkspaceId(userId)
  if (!workspaceId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Verify caller is an active member of the resolved workspace
  const member = await prisma.member.findFirst({
    where: { userId, workspaceId, deactivatedAt: null },
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

  const postUserId = await resolveSessionUserId(session)
  if (!postUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const postWorkspaceId = await resolveWorkspaceId(postUserId)
  if (!postWorkspaceId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const member = await prisma.member.findFirst({
    where: { userId: postUserId, workspaceId: postWorkspaceId, deactivatedAt: null },
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
