import { auth } from '@/lib/auth'
import { notFound } from 'next/navigation'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { ArticleEditor } from '@/components/editor/ArticleEditor'
import { isHtml, mdToHtml } from '@/lib/content'

export default async function EditArticlePage(props: { params: Promise<{ id: string }>; searchParams: Promise<{ pickCollection?: string }> }) {
  const [params, searchParams] = await Promise.all([props.params, props.searchParams])
  const session = await auth()
  if (!session?.user) redirect('/login')

  const article = await prisma.article.findUnique({
    where: { id: params.id },
    include: { collection: true },
  })
  if (!article) notFound()

  const workspace = await prisma.workspace.findUnique({
    where: { id: article.workspaceId },
    select: { slug: true },
  })

  const rawCollections = await prisma.collection.findMany({
    where: {
      workspaceId: article.workspaceId,
      OR: [
        { isArchived: false },
        { id: article.collectionId },
      ],
    },
    select: { id: true, title: true, emoji: true, isArchived: true, parentId: true },
    orderBy: [{ isArchived: 'asc' }, { order: 'asc' }],
  })

  // Build hierarchical flat list: root → subs → grandchildren
  const byParent = new Map<string | null, typeof rawCollections>()
  for (const c of rawCollections) {
    const key = c.parentId ?? null
    if (!byParent.has(key)) byParent.set(key, [])
    byParent.get(key)!.push(c)
  }
  const collections: (typeof rawCollections[0] & { depth: number })[] = []
  for (const root of byParent.get(null) ?? []) {
    collections.push({ ...root, depth: 0 })
    for (const sub of byParent.get(root.id) ?? []) {
      collections.push({ ...sub, depth: 1 })
      for (const grand of byParent.get(sub.id) ?? []) {
        collections.push({ ...grand, depth: 2 })
      }
    }
  }

  // Load draftContent if present (unsaved edits on a published article),
  // otherwise fall back to the live content. Convert Markdown on the way in.
  const raw = article.draftContent ?? article.content
  const content = isHtml(raw) ? raw : mdToHtml(raw)
  const hasDraft = article.status === 'PUBLISHED' && !!article.draftContent

  return (
    <ArticleEditor
      article={{
        id: article.id,
        title: article.title,
        slug: article.slug,
        content,
        excerpt: article.excerpt ?? '',
        status: article.status,
        collectionId: article.collectionId,
        collectionSlug: article.collection.slug,
        hasDraft,
        aiGenerated: article.aiGenerated,
      }}
      collections={collections}
      workspaceSlug={workspace?.slug ?? ''}
      autoOpenCollectionPicker={searchParams.pickCollection === 'true'}
    />
  )
}
