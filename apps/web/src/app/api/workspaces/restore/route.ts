import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { auth, resolveSessionUserId } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { qdrant, COLLECTION_NAME, ensureCollection, chunkText, buildPointId } from '@/lib/qdrant'
import { embedBatch } from '@/lib/embeddings'

const RESTORE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000
const MANGLED_SLUG_RE = /--deleted-[a-z0-9]+$/

const RESERVED_SLUGS = new Set([
  'api', 'admin', 'dashboard', 'login', 'logout', 'signup', 'onboarding',
  'invite', 'settings', 'billing', 'help', 'www', 'mail', 'support',
  'status', 'health', 'static', 'assets', '_next', 'imports', 'widget',
  'workspaces',
])

function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * POST /api/workspaces/restore
 * Restores a soft-deleted workspace. OWNER only, within 30 days.
 * Body: { workspaceId, slug? }
 */
export async function POST(request: Request) {
  const session = await auth()
  const userId = await resolveSessionUserId(session)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { workspaceId, slug: requestedSlug } = (await request.json()) as {
    workspaceId?: string
    slug?: string
  }

  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 })
  }

  const member = await prisma.member.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { role: true, deactivatedAt: true },
  })
  if (!member || member.deactivatedAt !== null || member.role !== 'OWNER') {
    return NextResponse.json({ error: 'Only the workspace owner can restore it' }, { status: 403 })
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { deletedAt: true, name: true, slug: true },
  })
  if (!workspace) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  }
  if (!workspace.deletedAt) {
    return NextResponse.json({ error: 'Workspace is not deleted' }, { status: 400 })
  }

  const elapsed = Date.now() - workspace.deletedAt.getTime()
  if (elapsed > RESTORE_WINDOW_MS) {
    return NextResponse.json({ error: 'Restore window has expired (30 days)' }, { status: 410 })
  }

  const isMangled = MANGLED_SLUG_RE.test(workspace.slug)

  // If slug was claimed (mangled) and no new slug provided, tell the client
  if (isMangled && !requestedSlug?.trim()) {
    return NextResponse.json({ error: 'slugRequired' }, { status: 400 })
  }

  let finalSlug = workspace.slug

  if (isMangled && requestedSlug?.trim()) {
    // Validate the user-provided slug
    finalSlug = slugify(requestedSlug.trim())
    if (!finalSlug || finalSlug.length < 3) {
      return NextResponse.json({ error: 'Slug must be at least 3 characters' }, { status: 400 })
    }
    if (finalSlug.length > 30) {
      return NextResponse.json({ error: 'Slug must be at most 30 characters' }, { status: 400 })
    }
    if (RESERVED_SLUGS.has(finalSlug)) {
      return NextResponse.json({ error: 'That URL is reserved' }, { status: 400 })
    }

    // Check uniqueness + lazy mangle inside transaction
    try {
      await prisma.$transaction(async (tx) => {
        await tx.workspace.updateMany({
          where: { slug: finalSlug, deletedAt: { not: null }, id: { not: workspaceId } },
          data: { slug: `${finalSlug}--deleted-${Date.now().toString(36)}` },
        })

        const taken = await tx.workspace.findFirst({
          where: { slug: finalSlug, deletedAt: null, id: { not: workspaceId } },
        })
        if (taken) {
          throw Object.assign(new Error('SLUG_TAKEN'), { code: 'SLUG_TAKEN' })
        }

        await tx.workspace.update({
          where: { id: workspaceId },
          data: { deletedAt: null, slug: finalSlug },
        })
      })
    } catch (err) {
      const code = (err as { code?: string }).code
      if (code === 'SLUG_TAKEN' || code === 'P2002') {
        return NextResponse.json({ error: 'That URL is already taken' }, { status: 409 })
      }
      throw err
    }
  } else {
    // Slug is intact — simple restore
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { deletedAt: null },
    })
  }

  // Set as active workspace
  const cookieStore = await cookies()
  cookieStore.set('helpnest-workspace', workspaceId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 365 * 24 * 60 * 60,
  })

  // NOTE: In serverless environments (Vercel, AWS Lambda), this fire-and-forget
  // re-sync may be killed when the response is sent. For reliable re-sync in
  // serverless, trigger POST /api/embeddings/sync from the client after restore,
  // or use a background job queue. In long-lived servers (Docker, self-hosted),
  // this runs to completion.
  triggerEmbeddingResync(workspaceId)

  return NextResponse.json({
    restored: true,
    name: workspace.name,
    slug: finalSlug,
    workspaceId,
  })
}

/**
 * Trigger a full embedding re-sync for a restored workspace.
 * Fire-and-forget — failures are logged but don't block the response.
 */
function triggerEmbeddingResync(workspaceId: string) {
  void (async () => {
    try {
      if (!process.env.OPENAI_API_KEY) return
      await ensureCollection()

      const articles = await prisma.article.findMany({
        where: { workspaceId, status: 'PUBLISHED' },
        select: {
          id: true, title: true, content: true, slug: true, collectionId: true,
          collection: { select: { visibility: true } },
        },
      })

      for (const article of articles) {
        const fullText = `${article.title}\n\n${article.content}`
        const chunks = chunkText(fullText)

        let embeddings: number[][]
        try {
          embeddings = await embedBatch(chunks)
        } catch {
          continue // Skip if OpenAI unavailable
        }

        const points = chunks.map((chunk, i) => ({
          id: buildPointId(article.id, i),
          vector: embeddings[i] ?? [],
          payload: {
            articleId: article.id,
            workspaceId,
            collectionId: article.collectionId,
            visibility: article.collection.visibility,
            slug: article.slug,
            title: article.title,
            chunk,
            chunkIndex: i,
          },
        }))

        await qdrant.upsert(COLLECTION_NAME, { points, wait: true })
      }
    } catch (err) {
      console.error('[workspace-restore] Embedding re-sync failed:', err)
    }
  })()
}
