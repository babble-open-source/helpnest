import { prisma } from '@/lib/db'
import { auth, resolveSessionUserId } from '@/lib/auth'
import { resolveWorkspaceId } from '@/lib/workspace'
import { isDemoMode } from '@/lib/demo'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { NewCollectionModal } from './NewCollectionModal'
import { CollectionRow } from './CollectionRow'
import { SearchInput } from '@/components/ui/SearchInput'
import { Card } from '@/components/ui/card'

export default async function CollectionsPage(props: {
  searchParams: Promise<{ q?: string }>
}) {
  const [session, searchParams, t, tc] = await Promise.all([auth(), props.searchParams, getTranslations('dashboard'), getTranslations('common')])
  if (!session?.user) redirect('/login')

  const userId = await resolveSessionUserId(session)
  if (!userId) redirect('/login')

  const workspaceId = await resolveWorkspaceId(userId)
  if (!workspaceId) redirect('/')

  const demoMode = isDemoMode()

  const collections = await prisma.collection.findMany({
    where: {
      workspaceId,
      parentId: null,
      ...(searchParams.q ? {
        OR: [
          { title: { contains: searchParams.q, mode: 'insensitive' as const } },
          { subCollections: { some: {
            OR: [
              { title: { contains: searchParams.q, mode: 'insensitive' as const } },
              { subCollections: { some: { title: { contains: searchParams.q, mode: 'insensitive' as const } } } },
            ],
          }}},
        ],
      } : {}),
    },
    orderBy: [{ isArchived: 'asc' }, { order: 'asc' }],
    include: {
      _count: { select: { articles: true, subCollections: true } },
      subCollections: {
        orderBy: [{ isArchived: 'asc' }, { order: 'asc' }],
        include: {
          _count: { select: { articles: true, subCollections: true } },
          subCollections: {
            orderBy: [{ isArchived: 'asc' }, { order: 'asc' }],
            include: {
              _count: { select: { articles: true, subCollections: true } },
            },
          },
        },
      },
    },
  })

  return (
    <div className="p-4 sm:p-8">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t('collections')}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {tc('collections', { count: collections.length })}
          </p>
        </div>
        <NewCollectionModal />
      </div>

      <SearchInput placeholder={t('searchCollections')} className="w-full sm:w-64 mb-6" />

      {collections.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-4xl mb-3">📁</p>
          <p className="font-medium text-foreground mb-1">{t('noCollectionsYet')}</p>
          <p className="text-muted-foreground text-sm">{t('collectionsDescription')}</p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {collections.map((col) => (
            <CollectionRow key={col.id} collection={col} demoMode={demoMode} defaultExpanded={!!searchParams.q} />
          ))}
        </div>
      )}
    </div>
  )
}
