import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { NewCollectionModal } from './NewCollectionModal'

export default async function CollectionsPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const member = await prisma.member.findFirst({
    where: { user: { email: session.user.email! } },
    select: { workspaceId: true },
  })
  if (!member) redirect('/dashboard')

  const collections = await prisma.collection.findMany({
    where: { workspaceId: member.workspaceId, parentId: null },
    orderBy: { order: 'asc' },
    include: {
      _count: { select: { articles: { where: { status: 'PUBLISHED' } } } },
      subCollections: {
        include: {
          _count: { select: { articles: { where: { status: 'PUBLISHED' } } } },
        },
      },
    },
  })

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-3xl text-ink">Collections</h1>
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
            <div key={col.id} className="bg-white rounded-xl border border-border p-5">
              <div className="flex items-start gap-4">
                <span className="text-2xl">{col.emoji ?? '📄'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="font-medium text-ink">{col.title}</h3>
                      {col.description && (
                        <p className="text-sm text-muted mt-0.5">{col.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-sm text-muted">
                        {col._count.articles} articles
                      </span>
                      <button className="text-xs text-muted hover:text-accent transition-colors">
                        Edit
                      </button>
                      <button className="text-xs text-muted hover:text-red-500 transition-colors">
                        Delete
      </button>
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
