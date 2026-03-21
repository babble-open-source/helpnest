import { prisma } from '@/lib/db'
import { auth, resolveSessionUserId } from '@/lib/auth'
import { resolveWorkspaceId } from '@/lib/workspace'
import { isDemoMode } from '@/lib/demo'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { NewCollectionModal } from './NewCollectionModal'
import { CollectionActions } from './CollectionActions'
import { SearchInput } from '@/components/ui/SearchInput'

export default async function CollectionsPage(props: {
  searchParams: Promise<{ q?: string }>
}) {
  const [session, searchParams, t, tc] = await Promise.all([auth(), props.searchParams, getTranslations('dashboard'), getTranslations('common')])
  if (!session?.user) redirect('/login')

  const userId = await resolveSessionUserId(session)
  if (!userId) redirect('/login')

  const workspaceId = await resolveWorkspaceId(userId)
  if (!workspaceId) redirect('/dashboard')

  const demoMode = isDemoMode()

  type SubCollection = {
    id: string
    title: string
    emoji: string | null
    isArchived: boolean
    _count: { articles: number }
  }
  type CollectionWithSubs = {
    id: string
    title: string
    description: string | null
    emoji: string | null
    isArchived: boolean
    _count: { articles: number }
    subCollections: SubCollection[]
  }
  const collections: CollectionWithSubs[] = await prisma.collection.findMany({
    where: {
      workspaceId: workspaceId,
      parentId: null,
      ...(searchParams.q
        ? { title: { contains: searchParams.q, mode: 'insensitive' as const } }
        : {}),
    },
    orderBy: [
      { isArchived: 'asc' },
      { order: 'asc' },
    ],
    include: {
      _count: { select: { articles: true } },
      subCollections: {
        orderBy: [
          { isArchived: 'asc' },
          { order: 'asc' },
        ],
        include: {
          _count: { select: { articles: true } },
        },
      },
    },
  })

  return (
    <div className="p-4 sm:p-8">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl text-ink">{t('collections')}</h1>
          <p className="text-muted text-sm mt-1">
            {tc('collections', { count: collections.length })}
          </p>
        </div>
        <NewCollectionModal />
      </div>

      <SearchInput placeholder={t('searchCollections')} className="w-full sm:w-64 mb-6" />

      {collections.length === 0 ? (
        <div className="bg-white rounded-xl border border-border p-12 text-center">
          <p className="text-4xl mb-3">📁</p>
          <p className="font-medium text-ink mb-1">{t('noCollectionsYet')}</p>
          <p className="text-muted text-sm">
            {t('collectionsDescription')}
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {collections.map((col) => (
            <div
              key={col.id}
              className={`rounded-xl border p-5 ${
                col.isArchived ? 'bg-stone-50 border-border/80' : 'bg-white border-border'
              }`}
            >
              <div className="flex items-start gap-4">
                <Link href={`/dashboard/collections/${col.id}`} className="text-2xl">{col.emoji ?? '📄'}</Link>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <Link href={`/dashboard/collections/${col.id}`} className="font-medium text-ink hover:text-accent transition-colors">{col.title}</Link>
                        {col.isArchived && (
                          <span className="rounded-full bg-border/70 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted">
                            {tc('archived')}
                          </span>
                        )}
                      </div>
                      {col.description && (
                        <p className="text-sm text-muted mt-0.5">{col.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-sm text-muted">
                        {tc('articles', { count: col._count.articles })}
                      </span>
                      <CollectionActions
                        collection={{
                          id: col.id,
                          title: col.title,
                          description: col.description,
                          emoji: col.emoji,
                          articleCount: col._count.articles,
                          isArchived: col.isArchived,
                        }}
                        demoMode={demoMode}
                      />
                    </div>
                  </div>
                  {col.subCollections.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border flex flex-wrap gap-2">
                      {col.subCollections.map((sub) => (
                        <div
                          key={sub.id}
                          className="flex items-center gap-1.5 text-sm text-muted"
                        >
                          <span>{sub.emoji ?? '📂'}</span>
                          <span>{sub.title}</span>
                          {sub.isArchived && <span className="text-xs uppercase tracking-wide">{tc('archived')}</span>}
                          <span className="text-xs">({sub._count.articles})</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
