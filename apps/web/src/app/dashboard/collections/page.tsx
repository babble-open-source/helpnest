import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { isDemoMode } from '@/lib/demo'
import { redirect } from 'next/navigation'
import { NewCollectionModal } from './NewCollectionModal'
import { CollectionActions } from './CollectionActions'

export default async function CollectionsPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const demoMode = isDemoMode()

  const member = await prisma.member.findFirst({
    where: { user: { email: session.user.email! } },
    select: { workspaceId: true },
  })
  if (!member) redirect('/dashboard')

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
    where: { workspaceId: member.workspaceId, parentId: null },
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
          <h1 className="font-serif text-2xl sm:text-3xl text-ink">Collections</h1>
          <p className="text-muted text-sm mt-1">
            {collections.length} collection{collections.length !== 1 ? 's' : ''}
          </p>
        </div>
        <NewCollectionModal />
      </div>

      {collections.length === 0 ? (
        <div className="bg-white rounded-xl border border-border p-12 text-center">
          <p className="text-4xl mb-3">📁</p>
          <p className="font-medium text-ink mb-1">No collections yet</p>
          <p className="text-muted text-sm">
            Collections organise your articles into topics
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
                <span className="text-2xl">{col.emoji ?? '📄'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-ink">{col.title}</h3>
                        {col.isArchived && (
                          <span className="rounded-full bg-border/70 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted">
                            Archived
                          </span>
                        )}
                      </div>
                      {col.description && (
                        <p className="text-sm text-muted mt-0.5">{col.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-sm text-muted">
                        {col._count.articles} article{col._count.articles !== 1 ? 's' : ''}
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
                          {sub.isArchived && <span className="text-xs uppercase tracking-wide">archived</span>}
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
