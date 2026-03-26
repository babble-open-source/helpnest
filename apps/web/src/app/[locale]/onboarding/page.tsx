import { auth, resolveSessionUserId } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { resolveWorkspaceId } from '@/lib/workspace'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { OnboardingForm } from './OnboardingForm'

export const dynamic = 'force-dynamic'

export default async function OnboardingPage() {
  const session = await auth()
  const userId = await resolveSessionUserId(session)
  if (!userId || !session?.user) redirect('/login')

  const workspaceId = await resolveWorkspaceId(userId)
  if (workspaceId) redirect('/dashboard')

  // Check for restorable deleted workspaces
  const RESTORE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000
  const restoreCutoff = new Date(Date.now() - RESTORE_WINDOW_MS)
  const deletedWorkspaces = await prisma.member.findMany({
    where: {
      userId,
      deactivatedAt: null,
      workspace: {
        deletedAt: { not: null, gt: restoreCutoff },
      },
    },
    select: {
      workspace: { select: { name: true, deletedAt: true } },
    },
  })

  const t = await getTranslations('onboarding')
  const tw = await getTranslations('workspaces')

  const helpCenterDomain = process.env.NEXT_PUBLIC_HELP_CENTER_DOMAIN ?? ''
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  // Path mode (self-hosted): prefix like "localhost:3000/"
  // Subdomain mode (cloud): suffix like ".helpnest.cloud"
  const slugPrefix = helpCenterDomain ? '' : `${appUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}/`
  const slugSuffix = helpCenterDomain ? `.${helpCenterDomain}` : ''

  return (
    <>
      {deletedWorkspaces.length > 0 && (
        <div className="max-w-md mx-auto px-4 mt-8">
          <div className="rounded-xl border border-border bg-white p-5 mb-6">
            <p className="font-medium text-ink text-sm mb-2">{tw('onboardingBanner')}</p>
            {deletedWorkspaces.map((m, i) => (
              <p key={i} className="text-sm text-muted">
                &ldquo;{m.workspace.name}&rdquo;
              </p>
            ))}
            <Link
              href="/workspaces"
              className="inline-block mt-3 text-sm font-medium text-accent hover:underline"
            >
              {tw('onboardingViewLink')} &rarr;
            </Link>
          </div>
        </div>
      )}
      <OnboardingForm
        userName={session.user.name ?? ''}
        slugPrefix={slugPrefix}
        slugSuffix={slugSuffix}
        translations={{
          title: t('title'),
          subtitle: t('subtitle'),
          helpCenterName: t('helpCenterName'),
          helpCenterNamePlaceholder: t('helpCenterNamePlaceholder'),
          urlSlug: t('urlSlug'),
          slugPlaceholder: t('slugPlaceholder'),
          slugHint: t('slugHint'),
          createButton: t('createButton'),
          creating: t('creating'),
        }}
      />
    </>
  )
}
