import { prisma } from '@/lib/db'
import { auth, resolveSessionUserId } from '@/lib/auth'
import { resolveWorkspaceId } from '@/lib/workspace'
import { isDemoMode } from '@/lib/demo'
import { redirect, notFound } from 'next/navigation'
import { Link } from '@/i18n/navigation'
import { getTranslations } from 'next-intl/server'
import { SimpleTooltip as Tooltip } from '@/components/ui/simple-tooltip'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ArticlesTable } from '../../articles/ArticlesTable'
import { NewCollectionModal } from '../NewCollectionModal'
import { CollectionActions } from '../CollectionActions'
import { createArticle } from '../../articles/actions'

export default async function CollectionDetailPage(props: {
  params: Promise<{ id: string }>
}) {
  const [session, params, t, tc] = await Promise.all([
    auth(),
    props.params,
    getTranslations('dashboard'),
    getTranslations('common'),
  ])
  if (!session?.user) redirect('/login')

  const userId = await resolveSessionUserId(session)
  if (!userId) redirect('/login')

  const workspaceId = await resolveWorkspaceId(userId)
  if (!workspaceId) redirect('/dashboard')

  const demoMode = isDemoMode()

  const collection = await prisma.collection.findFirst({
    where: { id: params.id, workspaceId },
    include: {
      parent: { select: { id: true, title: true, parentId: true, parent: { select: { id: true, title: true } } } },
      subCollections: {
        orderBy: [{ isArchived: 'asc' }, { order: 'asc' }],
        include: {
          _count: { select: { articles: true, subCollections: true } },
        },
      },
    },
  })
  if (!collection) notFound()

  const articles = await prisma.article.findMany({
    where: { collectionId: collection.id, workspaceId },
    orderBy: { updatedAt: 'desc' },
    include: { collection: true, author: true },
  })

  // depth 1 = root, depth 2 = child of root, depth 3 = grandchild (max).
  // A depth-3 collection cannot have sub-collections.
  const depth = !collection.parentId ? 1 : !collection.parent?.parentId ? 2 : 3
  const canAddSubCollection = depth < 3

  return (
    <div className="p-4 sm:p-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link href="/dashboard/collections" className="hover:text-foreground transition-colors">
          {t('collections')}
        </Link>
        {collection.parent?.parent && (
          <>
            <span className="shrink-0">/</span>
            <Tooltip content={collection.parent.parent.title}>
              <Link href={`/dashboard/collections/${collection.parent.parent.id}`} className="hover:text-foreground transition-colors truncate max-w-[80px] sm:max-w-[150px] lg:max-w-[220px] block">
                {collection.parent.parent.title}
              </Link>
            </Tooltip>
          </>
        )}
        {collection.parent && (
          <>
            <span className="shrink-0">/</span>
            <Tooltip content={collection.parent.title}>
              <Link href={`/dashboard/collections/${collection.parent.id}`} className="hover:text-foreground transition-colors truncate max-w-[80px] sm:max-w-[150px] lg:max-w-[220px] block">
                {collection.parent.title}
              </Link>
            </Tooltip>
          </>
        )}
        <span className="shrink-0">/</span>
        <Tooltip content={collection.title}>
          <span className="text-foreground truncate max-w-[100px] sm:max-w-[180px] lg:max-w-[260px] block">{collection.title}</span>
        </Tooltip>
      </div>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-3 min-w-0">
            <span className="text-2xl sm:text-3xl mt-1 shrink-0">{collection.emoji ?? '📁'}</span>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl sm:text-3xl font-semibold text-foreground flex items-center gap-3">
                <Tooltip content={collection.title} wrapperClassName="flex-1 min-w-0">
                  <span className="truncate block">{collection.title}</span>
                </Tooltip>
                {articles.length > 0 && (
                  <Badge variant="secondary" className="shrink-0 bg-orange-500/10 text-orange-500 hover:bg-orange-500/10">
                    {tc('articles', { count: articles.length })}
                  </Badge>
                )}
                {collection.subCollections.length > 0 && (
                  <Badge variant="secondary" className="shrink-0 bg-orange-500/10 text-orange-500 hover:bg-orange-500/10">
                    {tc('subCollections', { count: collection.subCollections.length })}
                  </Badge>
                )}
              </h1>
              {collection.description && (
                <p className="text-muted-foreground text-sm mt-1">{collection.description}</p>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {canAddSubCollection && (
            <NewCollectionModal parentId={collection.id} parentTitle={collection.title} />
          )}
          <form action={createArticle}>
            <input type="hidden" name="collectionId" value={collection.id} />
            <Button type="submit">
              {t('newArticle')}
            </Button>
          </form>
        </div>
      </div>

      {/* Sub-collections */}
      {collection.subCollections.length > 0 && (
        <div className="my-8">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {collection.subCollections.map((sub) => (
              <div
                key={sub.id}
                className={`rounded-lg border p-4 flex items-center justify-between gap-3 ${
                  sub.isArchived ? 'bg-muted/30 border-border/80' : 'bg-card border'
                }`}
              >
                <Link href={`/dashboard/collections/${sub.id}`} className="flex items-center gap-2 min-w-0 flex-1 group">
                  <span className="text-xl">{sub.emoji ?? '📂'}</span>
                  <div className="flex items-center gap-2 min-w-0">
                    <Tooltip content={sub.title} wrapperClassName="min-w-0 overflow-hidden">
                      <p className="text-sm font-medium text-foreground group-hover:text-orange-500 transition-colors truncate">{sub.title}</p>
                    </Tooltip>
                    {sub._count.articles > 0 && (
                      <Badge variant="secondary" className="shrink-0 text-[11px] bg-orange-500/10 text-orange-500 hover:bg-orange-500/10">
                        {tc('articles', { count: sub._count.articles })}
                      </Badge>
                    )}
                  </div>
                </Link>
                <CollectionActions
                  collection={{
                    id: sub.id,
                    title: sub.title,
                    description: sub.description,
                    emoji: sub.emoji,
                    visibility: sub.visibility,
                    articleCount: sub._count.articles,
                    subCollectionCount: sub._count.subCollections,
                    isArchived: sub.isArchived,
                  }}
                  demoMode={demoMode}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Articles */}
      {articles.length === 0 && collection.subCollections.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-4xl mb-3">📝</p>
          <p className="font-medium text-foreground mb-1">{t('noArticlesYet')}</p>
          <p className="text-muted-foreground text-sm mb-4">{t('createFirstArticle')}</p>
          <form action={createArticle}>
            <input type="hidden" name="collectionId" value={collection.id} />
            <button type="submit" className="text-orange-500 hover:underline text-sm">
              {t('createArticle')}
            </button>
          </form>
        </Card>
      ) : articles.length > 0 ? (
        <ArticlesTable articles={articles} demoMode={demoMode} />
      ) : null}
    </div>
  )
}

