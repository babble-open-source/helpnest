import { hasWorkspaceBrandTextColumn, prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import { Link } from '@/i18n/navigation'
import { getTranslations } from 'next-intl/server'
import { WorkspaceBrandLink } from '@/components/help/WorkspaceBrandLink'
import { DashboardButton } from '@/components/help/DashboardButton'
import { AskAIClient } from './AskAIClient'

interface Props {
  params: Promise<{ workspace: string }>
}

export default async function AskAIPage(props: Props) {
  const params = await props.params
  const t = await getTranslations('askAI')
  const brandTextColumnExists = await hasWorkspaceBrandTextColumn()
  const workspace = await prisma.workspace.findUnique({
    where: { slug: params.workspace, deletedAt: null },
    select: { id: true, name: true, logo: true },
  })
  if (!workspace) notFound()

  const brandTextRecord = brandTextColumnExists
    ? await prisma.workspace.findUnique({
        where: { id: workspace.id },
        select: { brandText: true },
      })
    : null

  return (
    <div className="h-[100dvh] bg-cream flex flex-col">
      {/* Nav */}
      <nav className="shrink-0 bg-cream/95 backdrop-blur border-b border-border">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between gap-2">

          {/* Mobile: back arrow + page title */}
          <div className="flex items-center gap-2 sm:hidden min-w-0">
            <Link
              href={`/${params.workspace}/help`}
              className="p-1.5 -ml-1.5 rounded-lg text-muted hover:text-ink hover:bg-border/40 transition-colors shrink-0"
              aria-label={t('title')}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div className="flex items-center gap-1.5 text-sm font-medium text-ink min-w-0">
              <svg className="w-3.5 h-3.5 text-green shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>{t('title')}</span>
            </div>
          </div>

          {/* Desktop: full breadcrumb */}
          <div className="hidden sm:flex items-center gap-2 min-w-0">
            <WorkspaceBrandLink
              href={`/${params.workspace}/help`}
              name={workspace.name}
              logo={workspace.logo}
              brandText={brandTextRecord?.brandText ?? null}
              hideNameWhenLogo
              className="shrink-0"
              textClassName="text-muted hover:text-ink transition-colors"
            />
            <span className="text-border">/</span>
            <div className="flex items-center gap-1.5 text-sm font-medium text-ink">
              <svg className="w-3.5 h-3.5 text-green shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {t('title')}
            </div>
          </div>

          <DashboardButton />
        </div>
      </nav>

      {/* Chat — fills remaining height */}
      <div className="flex-1 min-h-0 max-w-2xl w-full mx-auto flex flex-col">
        <AskAIClient workspace={params.workspace} workspaceName={workspace.name} />
      </div>
    </div>
  )
}
