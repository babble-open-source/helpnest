import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { isDemoMode } from '@/lib/demo'
import { redirect, notFound } from 'next/navigation'
import { Link } from '@/i18n/navigation'
import { getTranslations } from 'next-intl/server'
import { ArticlesTable } from '../../articles/ArticlesTable'

export default async function CollectionDetailPage(props: {
  params: Promise<{ id: string }>
}) {
  const [session, params, t, tc] = await Promise.all([
    auth(),
    props.params,
    getTranslations('dashboard'),
    getTranslations('common'),
  ])
  if (!session?.user?.email) redirect('/login')

  const demoMode = isDemoMode()

  const member = await prisma.member.findFirst({
    where: { user: { email: session.user.email } },
    select: { workspaceId: true },
  })
  if (!member) redirect('/dashboard')

  const collection = await prisma.collection.findFirst({
    where: { id: params.id, workspaceId: member.workspaceId },
  })
  if (!collection) notFound()

  const articles = await prisma.article.findMany({
    where: { collectionId: collection.id, workspaceId: member.workspaceId },
    orderBy: { updatedAt: 'desc' },
    include: { collection: true, author: true },
  })

  return (
    <div className="p-4 sm:p-8">
      <div className="flex items-center gap-2 text-sm text-muted mb-6">
        <Link href="/dashboard/collections" className="hover:text-ink transition-colors">
          {t('collections')}
        </Link>
        <span>/</span>
        <span className="text-ink">{collection.title}</span>
      </div>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl text-ink flex items-center gap-2">
            <span>{collection.emoji ?? '📁'}</span>
            <span>{collection.title}</span>
          </h1>
          {collection.description && (
            <p className="text-muted text-sm mt-1">{collection.description}</p>
          )}
          <p className="text-muted text-sm mt-1">
            {tc('articles', { count: articles.length })}
          </p>
        </div>
        <Link
          href={`/dashboard/articles/new?collection=${collection.id}`}
          className="bg-ink text-cream px-3 sm:px-4 py-2 rounded-lg text-sm hover:bg-ink/90 transition-colors font-medium shrink-0"
        >
          {t('newArticle')}
        </Link>
      </div>

      {articles.length === 0 ? (
        <div className="bg-white rounded-xl border border-border p-12 text-center">
          <p className="text-4xl mb-3">📝</p>
          <p className="font-medium text-ink mb-1">{t('noArticlesYet')}</p>
          <p className="text-muted text-sm mb-4">{t('createFirstArticle')}</p>
          <Link href="/dashboard/articles/new" className="text-accent hover:underline text-sm">
            {t('createArticle')}
          </Link>
        </div>
      ) : (
        <ArticlesTable articles={articles} demoMode={demoMode} />
      )}
    </div>
  )
}
