import { hasWorkspaceBrandTextColumn, prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import { WorkspaceBrandLink } from '@/components/help/WorkspaceBrandLink'
import { DashboardButton } from '@/components/help/DashboardButton'
import { AskAIClient } from './AskAIClient'

interface Props {
  params: Promise<{ workspace: string }>
}

export default async function AskAIPage(props: Props) {
  const params = await props.params
  const brandTextColumnExists = await hasWorkspaceBrandTextColumn()
  const workspace = await prisma.workspace.findUnique({
    where: { slug: params.workspace },
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
          <div className="flex items-center gap-2 min-w-0">
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
              Ask AI
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
