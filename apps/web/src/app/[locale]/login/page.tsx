import { prisma } from '@/lib/db'
import { isDemoMode } from '@/lib/demo'
import { auth, resolveSessionUserId } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { LoginForm } from './LoginForm'

export const dynamic = 'force-dynamic'

const DEFAULT_EMAIL = 'admin@helpnest.cloud'

export default async function LoginPage() {
  const session = await auth()
  const userId = await resolveSessionUserId(session)
  if (session?.user && userId) redirect('/dashboard')
  const demoMode = isDemoMode()
  const seedEmail = process.env.ADMIN_SEED_EMAIL ?? DEFAULT_EMAIL
  const t = await getTranslations('auth')
  const tCommon = await getTranslations('common')

  let workspaceSlug: string | null = null

  if (demoMode) {
    // In demo mode, fetch the workspace slug to show the public help center link.
    // Default email and password are shown; this is intentional for showcase use.
    const seedUser = await prisma.user.findUnique({
      where: { email: seedEmail },
      select: {
        members: { select: { workspace: { select: { slug: true } } }, take: 1 },
      },
    })
    workspaceSlug = seedUser?.members[0]?.workspace.slug ?? null
  }

  return (
    <LoginForm
      showDefaultCreds={demoMode}
      defaultEmail={demoMode ? seedEmail : ''}
      workspaceSlug={workspaceSlug}
      showSignupLink
      translations={{
        signInTitle: t('signInTitle'),
        signInSubtitle: t('signInSubtitle'),
        defaultAccount: t('defaultAccount'),
        emailLabel: t('emailLabel'),
        passwordLabel: t('passwordLabel'),
        defaultPassword: t('defaultPassword'),
        helpCenterLabel: t('helpCenterLabel'),
        changePasswordAdvice: t('changePasswordAdvice'),
        viewSource: t('viewSource'),
        email: t('email'),
        emailPlaceholder: t('emailPlaceholder'),
        password: t('password'),
        passwordPlaceholder: t('passwordPlaceholder'),
        invalidCredentials: t('invalidCredentials'),
        signInButton: t('signInButton'),
        signingIn: tCommon('signingIn'),
        dontHaveAccount: t('dontHaveAccount'),
        signUpFree: t('signUpFree'),
      }}
    />
  )
}
