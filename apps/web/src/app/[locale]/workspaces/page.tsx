import { auth, resolveSessionUserId } from '@/lib/auth'
import { getAllUserWorkspaces } from '@/lib/workspace'
import { isCloudMode } from '@/lib/cloud'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { getTranslations } from 'next-intl/server'
import { WorkspaceList } from './WorkspaceList'

export const dynamic = 'force-dynamic'

export default async function WorkspacesPage() {
  const session = await auth()
  const userId = await resolveSessionUserId(session)
  if (!userId || !session?.user) redirect('/login')

  const t = await getTranslations('workspaces')
  const { active, deleted } = await getAllUserWorkspaces(userId)

  const cookieStore = await cookies()
  const currentWorkspaceId = cookieStore.get('helpnest-workspace')?.value ?? null
  const cloudMode = isCloudMode()

  const helpCenterDomain = process.env.NEXT_PUBLIC_HELP_CENTER_DOMAIN ?? ''
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const slugPrefix = helpCenterDomain ? '' : `${appUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}/`
  const slugSuffix = helpCenterDomain ? `.${helpCenterDomain}` : ''

  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
        <div className="flex items-center justify-between mb-8">
          <h1 className="font-serif text-2xl sm:text-3xl text-ink">{t('title')}</h1>
        </div>
        <WorkspaceList
          active={active.map((w) => ({
            ...w,
            role: w.role as string,
            deletedAt: null,
          }))}
          deleted={deleted.map((w) => ({
            ...w,
            role: w.role as string,
            deletedAt: w.deletedAt.toISOString(),
          }))}
          currentWorkspaceId={currentWorkspaceId}
          cloudMode={cloudMode}
          slugPrefix={slugPrefix}
          slugSuffix={slugSuffix}
        />
      </div>
    </div>
  )
}
