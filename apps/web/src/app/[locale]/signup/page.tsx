import { auth, resolveSessionUserId } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { SignupForm } from './SignupForm'

export const dynamic = 'force-dynamic'

export default async function SignupPage() {
  const session = await auth()
  const userId = await resolveSessionUserId(session)
  if (session?.user && userId) redirect('/dashboard')

  const t = await getTranslations('auth')

  return (
    <SignupForm
      translations={{
        signUpTitle: t('signUpTitle'),
        signUpSubtitle: t('signUpSubtitle'),
        name: t('name'),
        namePlaceholder: t('namePlaceholder'),
        email: t('email'),
        emailPlaceholder: t('emailPlaceholder'),
        password: t('password'),
        passwordMinLength: t('passwordMinLength'),
        signUpButton: t('signUpButton'),
        creatingAccount: t('creatingAccount'),
        alreadyHaveAccount: t('alreadyHaveAccount'),
        signIn: t('signIn'),
        signupFailed: t('signupFailed'),
        signInFailed: t('signInFailed'),
        networkError: t('networkError'),
      }}
    />
  )
}
