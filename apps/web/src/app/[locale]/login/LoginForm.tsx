'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from '@/i18n/navigation'
import { Link } from '@/i18n/navigation'

interface Translations {
  signInTitle: string
  signInSubtitle: string
  defaultAccount: string
  emailLabel: string
  passwordLabel: string
  defaultPassword: string
  helpCenterLabel: string
  changePasswordAdvice: string
  viewSource: string
  email: string
  emailPlaceholder: string
  password: string
  passwordPlaceholder: string
  invalidCredentials: string
  signInButton: string
  signingIn: string
  dontHaveAccount: string
  signUpFree: string
}

interface Props {
  defaultEmail: string
  showDefaultCreds: boolean
  workspaceSlug: string | null
  showSignupLink?: boolean
  googleEnabled?: boolean
  translations: Translations
}

export function LoginForm({ defaultEmail, showDefaultCreds, workspaceSlug, showSignupLink, googleEnabled, translations: t }: Props) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })

    if (result?.error) {
      setError(t.invalidCredentials)
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <main className="min-h-screen bg-cream flex items-center justify-center">
      {showDefaultCreds && (
        <div className="fixed top-4 end-4 bg-amber-500 text-white text-xs font-semibold px-3 py-1 rounded-full shadow">
          DEMO
        </div>
      )}
      <div className="w-full max-w-sm px-6">
        <h1 className="font-serif text-3xl text-ink mb-2 text-center">{t.signInTitle}</h1>
        <p className="text-muted text-sm text-center mb-8">{t.signInSubtitle}</p>

        {showDefaultCreds && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm">
            <p className="font-medium text-amber-800 mb-2">{t.defaultAccount}</p>
            <p className="text-amber-700">
              {t.emailLabel} <code className="bg-amber-100 px-1 rounded">{defaultEmail}</code>
            </p>
            <p className="text-amber-700">
              {t.passwordLabel} <code className="bg-amber-100 px-1 rounded">{t.defaultPassword}</code>
            </p>
            {workspaceSlug && (
              <p className="text-amber-700 mt-1">
                {t.helpCenterLabel}{' '}
                <Link
                  href={`/${workspaceSlug}/help`}
                  className="underline underline-offset-2 hover:text-amber-900"
                >
                  /{workspaceSlug}/help
                </Link>
              </p>
            )}
            <p className="text-amber-600 text-xs mt-2">{t.changePasswordAdvice}</p>
            <a
              href="https://github.com/babble-open-source/helpnest"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-amber-700 hover:text-amber-900 mt-3 underline underline-offset-2"
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              {t.viewSource}
            </a>
          </div>
        )}

        {googleEnabled && (
          <>
            <button
              type="button"
              onClick={() => signIn('google', { callbackUrl: '/onboarding' })}
              className="w-full flex items-center justify-center gap-3 px-4 py-2 border border-border rounded-lg bg-white text-ink text-sm font-medium hover:bg-cream transition-colors"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-cream px-2 text-muted">or</span>
              </div>
            </div>
          </>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div suppressHydrationWarning>
            <label className="block text-sm font-medium text-ink mb-1">{t.email}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-border rounded-lg bg-white text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder={t.emailPlaceholder}
            />
          </div>
          <div suppressHydrationWarning>
            <label className="block text-sm font-medium text-ink mb-1">{t.password}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-white text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder={t.passwordPlaceholder}
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-ink text-cream py-2 px-4 rounded-lg hover:bg-ink/90 transition-colors font-medium disabled:opacity-60"
          >
            {loading ? t.signingIn : t.signInButton}
          </button>
        </form>

        {showSignupLink && (
          <p className="text-center text-sm text-muted mt-6">
            {t.dontHaveAccount}{' '}
            <Link href="/signup" className="text-accent hover:underline">
              {t.signUpFree}
            </Link>
          </p>
        )}
      </div>
    </main>
  )
}
