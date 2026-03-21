'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+/g, '')
}

// Only strip trailing hyphens on final validation, not while typing
function cleanSlug(str: string): string {
  return slugify(str).replace(/-+$/g, '')
}

export function OnboardingForm({ userName, urlPrefix }: { userName: string; urlPrefix: string }) {
  const router = useRouter()
  const [name, setName] = useState(userName ? `${userName}'s Help Center` : '')
  const [slug, setSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Auto-generate slug from name (unless user edited slug manually)
  useEffect(() => {
    if (!slugEdited) {
      setSlug(cleanSlug(name))
    }
  }, [name, slugEdited])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || slug.trim().length < 3) return

    const finalSlug = cleanSlug(slug)
    if (finalSlug.length < 3) {
      setError('Slug must be at least 3 characters.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/workspaces/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), slug: finalSlug }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Failed to create workspace.')
        setLoading(false)
        return
      }

      router.push('/dashboard')
      router.refresh()
    } catch {
      setError('Network error. Please try again.')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-ink mb-1.5">
          Help center name
        </label>
        <input
          id="name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2.5 border border-border rounded-lg bg-white text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent text-sm"
          placeholder="Acme Support"
        />
      </div>

      <div>
        <label htmlFor="slug" className="block text-sm font-medium text-ink mb-1.5">
          URL slug
        </label>
        <div className="flex items-center">
          <span className="text-sm text-muted bg-cream border border-border border-r-0 rounded-l-lg px-3 py-2.5 whitespace-nowrap">
            {urlPrefix}
          </span>
          <input
            id="slug"
            type="text"
            required
            value={slug}
            onChange={(e) => {
              // Allow hyphens while typing — only clean on submit
              setSlug(slugify(e.target.value))
              setSlugEdited(true)
            }}
            onBlur={() => setSlug(cleanSlug(slug))}
            className="flex-1 min-w-0 px-3 py-2.5 border border-border rounded-r-lg bg-white text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent text-sm"
            placeholder="acme-support"
          />
        </div>
        <p className="text-xs text-muted mt-1.5">
          This will be your help center&apos;s URL. You can change it later in settings.
        </p>
      </div>

      <button
        type="submit"
        disabled={loading || !name.trim() || slug.trim().length < 3}
        className="w-full bg-ink text-cream py-2.5 px-4 rounded-lg hover:bg-ink/90 transition-colors font-medium disabled:opacity-60"
      >
        {loading ? 'Creating\u2026' : 'Create help center'}
      </button>
    </form>
  )
}
