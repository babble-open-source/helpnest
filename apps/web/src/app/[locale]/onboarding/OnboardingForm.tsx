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

function cleanSlug(str: string): string {
  return slugify(str).replace(/-+$/g, '')
}

interface Translations {
  title: string
  subtitle: string
  helpCenterName: string
  helpCenterNamePlaceholder: string
  urlSlug: string
  slugPlaceholder: string
  slugHint: string
  createButton: string
  creating: string
}

export function OnboardingForm({
  userName,
  slugPrefix,
  slugSuffix,
  translations: t,
}: {
  userName: string
  slugPrefix: string
  slugSuffix: string
  translations: Translations
}) {
  const router = useRouter()
  const [name, setName] = useState(userName ? `${userName}'s Help Center` : '')
  const [slug, setSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

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
    <main className="min-h-screen bg-cream flex items-center justify-center">
      <div className="w-full max-w-md px-6 py-10">
        <h1 className="font-serif text-3xl text-ink mb-2 text-center">
          {t.title}
        </h1>
        <p className="text-muted text-sm text-center mb-8">
          {t.subtitle}
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-ink mb-1.5">
              {t.helpCenterName}
            </label>
            <input
              id="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2.5 border border-border rounded-lg bg-white text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent text-sm"
              placeholder={t.helpCenterNamePlaceholder}
            />
          </div>

          <div>
            <label htmlFor="slug" className="block text-sm font-medium text-ink mb-1.5">
              {t.urlSlug}
            </label>
            <div className="flex items-center">
              {slugPrefix && (
                <span className="text-sm text-muted bg-cream border border-border border-r-0 rounded-l-lg px-3 py-2.5 whitespace-nowrap">
                  {slugPrefix}
                </span>
              )}
              <input
                id="slug"
                type="text"
                required
                value={slug}
                onChange={(e) => {
                  setSlug(slugify(e.target.value))
                  setSlugEdited(true)
                }}
                onBlur={() => setSlug(cleanSlug(slug))}
                className={`flex-1 min-w-0 px-3 py-2.5 border border-border bg-white text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent text-sm ${
                  slugPrefix ? '' : 'rounded-l-lg'
                } ${slugSuffix ? '' : 'rounded-r-lg'}`}
                placeholder={t.slugPlaceholder}
              />
              {slugSuffix && (
                <span className="text-sm text-muted bg-cream border border-border border-l-0 rounded-r-lg px-3 py-2.5 whitespace-nowrap">
                  {slugSuffix}
                </span>
              )}
            </div>
            <p className="text-xs text-muted mt-1.5">
              {t.slugHint}
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || !name.trim() || slug.trim().length < 3}
            className="w-full bg-ink text-cream py-2.5 px-4 rounded-lg hover:bg-ink/90 transition-colors font-medium disabled:opacity-60"
          >
            {loading ? t.creating : t.createButton}
          </button>
        </form>
      </div>
    </main>
  )
}
