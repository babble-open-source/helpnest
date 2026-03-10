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
