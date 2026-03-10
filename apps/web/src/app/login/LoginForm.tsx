'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Props {
  defaultEmail: string
  showDefaultCreds: boolean
  workspaceSlug: string | null
}

export function LoginForm({ defaultEmail, showDefaultCreds, workspaceSlug }: Props) {
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
      setError('Invalid email or password.')
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <main className="min-h-screen bg-cream flex items-center justify-center">
      {showDefaultCreds && (
        <div className="fixed top-4 right-4 bg-amber-500 text-white text-xs font-semibold px-3 py-1 rounded-full shadow">
          DEMO
        </div>
      )}
      <div className="w-full max-w-sm px-6">
        <h1 className="font-serif text-3xl text-ink mb-2 text-center">Sign in</h1>
        <p className="text-muted text-sm text-center mb-8">to your HelpNest workspace</p>

        {showDefaultCreds && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm">
            <p className="font-medium text-amber-800 mb-2">Default account</p>
            <p className="text-amber-700">
              Email: <code className="bg-amber-100 px-1 rounded">{defaultEmail}</code>
            </p>
            <p className="text-amber-700">
              Password: <code className="bg-amber-100 px-1 rounded">helpnest</code>
            </p>
            {workspaceSlug && (
              <p className="text-amber-700 mt-1">
                Help center:{' '}
                <Link
                  href={`/${workspaceSlug}/help`}
                  className="underline underline-offset-2 hover:text-amber-900"
                >
                  /{workspaceSlug}/help
                </Link>
              </p>
            )}
            <p className="text-amber-600 text-xs mt-2">Change your password after signing in.</p>
            <a
              href="https://github.com/babble-open-source/helpnest"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-amber-700 hover:text-amber-900 mt-3 underline underline-offset-2"
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              View source on GitHub
            </a>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div suppressHydrationWarning>
            <label className="block text-sm font-medium text-ink mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-border rounded-lg bg-white text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="you@example.com"
            />
          </div>
          <div suppressHydrationWarning>
            <label className="block text-sm font-medium text-ink mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-white text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="Leave blank if not yet set"
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-ink text-cream py-2 px-4 rounded-lg hover:bg-ink/90 transition-colors font-medium disabled:opacity-60"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </main>
  )
}
