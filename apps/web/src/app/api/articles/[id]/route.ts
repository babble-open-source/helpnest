import { NextResponse } from 'next/server'
import { Prisma } from '@helpnest/db'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth-api'
import { isDemoMode } from '@/lib/demo'
import { htmlToMarkdown } from '@/lib/html-to-markdown'
import { slugify } from '@/lib/slugify'

export async function GET(
  request: Request,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const [authResult, params] = await Promise.all([requireAuth(request), paramsPromise])
  if (!authResult) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const format = searchParams.get('format')

  const article = await prisma.article.findFirst({
    where: {
      workspaceId: authResult.workspaceId,
      OR: [{ id: params.id }, { slug: params.id }],
    },
    include: { collection: true, author: true },
  })
  if (!article) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (format === 'markdown') {
    return NextResponse.json({ ...article, content: htmlToMarkdown(article.content ?? '') })
  }

  return NextResponse.json(article)
}

export async function PATCH(
  request: Request,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const [authResult, params] = await Promise.all([requireAuth(request), paramsPromise])
  if (!authResult) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { workspaceId } = authResult

  const body = await request.json() as {
    title?: string
    content?: string
    excerpt?: string
    collectionId?: string
    status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
    slug?: string
    publishDraft?: boolean
  }

  // Auto-generate slug from title if title changed and no explicit slug
  let slug = body.slug
  if (slug !== undefined && !slug.trim()) {
    // Empty slug provided — look up the current article title to regenerate
    const current = await prisma.article.findFirst({
      where: { id: (await paramsPromise).id, workspaceId },
      select: { title: true },
    })
    slug = current ? slugify(current.title) : undefined
  }
  if (body.title && !body.slug) {
    slug = slugify(body.title)
  }

  // Verify article belongs to the authenticated workspace
  const existing = await prisma.article.findFirst({
    where: { id: params.id, workspaceId },
    select: { id: true, status: true, draftContent: true },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (body.collectionId !== undefined) {
    const targetCollection = await prisma.collection.findFirst({
      where: { id: body.collectionId, workspaceId },
      select: { id: true, isArchived: true },
    })
    if (!targetCollection) {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 })
    }
    if (targetCollection.isArchived) {
      return NextResponse.json({ error: 'Cannot move an article into an archived collection' }, { status: 409 })
    }
  }

  const data: Record<string, unknown> = {}
  if (body.title !== undefined) data.title = body.title
  if (body.excerpt !== undefined) data.excerpt = body.excerpt
  if (body.collectionId !== undefined) data.collectionId = body.collectionId
  if (slug !== undefined) data.slug = slug

  if (body.content !== undefined) {
    if (body.publishDraft) {
      // Publishing: push draftContent (or the submitted content) to live content, clear draft
      data.content = existing.draftContent ?? body.content
      data.draftContent = null
    } else if (existing.status === 'PUBLISHED') {
      // Saving draft on a published article: store in draftContent, leave live content alone
      data.draftContent = body.content
    } else {
      // Saving a draft article: content goes straight to content
      data.content = body.content
    }
  }

  if (body.status !== undefined) {
    data.status = body.status
    if (body.status === 'PUBLISHED') data.publishedAt = new Date()
  }

  // Optimistic update with P2002 retry for slug uniqueness (avoids TOCTOU race)
  const baseSlug = slug
  let suffix = 1
  for (;;) {
    try {
      const article = await prisma.article.update({
        where: { id: params.id },
        data,
      })
      return NextResponse.json(article)
    } catch (e: unknown) {
      if (
        baseSlug !== undefined &&
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        data.slug = `${baseSlug}-${suffix++}`
      } else {
        throw e
      }
    }
  }
}

export async function DELETE(
  request: Request,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const [authResult, params] = await Promise.all([requireAuth(request), paramsPromise])
  if (!authResult) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (isDemoMode()) {
    const target = await prisma.article.findFirst({
      where: { id: params.id, workspaceId: authResult.workspaceId },
      select: { isSeeded: true },
    })
    if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (target.isSeeded) {
      return NextResponse.json({ error: 'Demo articles cannot be deleted.' }, { status: 403 })
    }
  }

  // For session-based auth, role enforcement is done by requireAuth indirectly via
  // getMember — but requireAuth only checks membership, not role. For delete, we
  // additionally verify the session-path user has at least EDITOR role.
  if (authResult.via === 'session' && authResult.userId) {
    const member = await prisma.member.findFirst({
      where: {
        userId: authResult.userId,
        workspaceId: authResult.workspaceId,
        role: { in: ['OWNER', 'ADMIN', 'EDITOR'] },
      },
      select: { id: true },
    })
    if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const article = await prisma.article.findFirst({
    where: { id: params.id, workspaceId: authResult.workspaceId },
    select: { id: true },
  })
  if (!article) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // ArticleVersion has onDelete: Cascade in the schema, so only the article
  // delete is needed — versions are automatically removed by the database.
  await prisma.article.delete({ where: { id: params.id } })

  return new NextResponse(null, { status: 204 })
}
