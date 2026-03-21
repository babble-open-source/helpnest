import { auth, resolveSessionUserId } from '@/lib/auth'
import { resolveWorkspaceId } from '@/lib/workspace'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { OnboardingForm } from './OnboardingForm'

export const dynamic = 'force-dynamic'

export default async function OnboardingPage() {
  const session = await auth()
  const userId = await resolveSessionUserId(session)
  if (!userId || !session?.user) redirect('/login')

  const workspaceId = await resolveWorkspaceId(userId)
  if (workspaceId) redirect('/dashboard')

  const t = await getTranslations('onboarding')

  const helpCenterDomain = process.env.NEXT_PUBLIC_HELP_CENTER_DOMAIN ?? ''
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  // Path mode (self-hosted): prefix like "localhost:3000/"
  // Subdomain mode (cloud): suffix like ".helpnest.cloud"
  const slugPrefix = helpCenterDomain ? '' : `${appUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}/`
  const slugSuffix = helpCenterDomain ? `.${helpCenterDomain}` : ''

  return (
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
  )
}
