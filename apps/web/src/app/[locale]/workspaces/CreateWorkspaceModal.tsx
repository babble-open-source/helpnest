'use client'

import { useState, useEffect, useRef } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { CrawlStep } from '../onboarding/CrawlStep'

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

interface Props {
  slugPrefix: string
  slugSuffix: string
  onClose: () => void
}

export function CreateWorkspaceModal({ slugPrefix, slugSuffix, onClose }: Props) {
  const locale = useLocale()
  const t = useTranslations('onboarding')
  const tc = useTranslations('crawl')
  const [step, setStep] = useState<'workspace' | 'crawl'>('workspace')
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const backdropRef = useRef<HTMLDivElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!slugEdited) setSlug(cleanSlug(name))
  }, [name, slugEdited])

  useEffect(() => {
    if (step === 'workspace') nameInputRef.current?.focus()
  }, [step])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && step === 'workspace') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose, step])

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === backdropRef.current && step === 'workspace') onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || slug.trim().length < 3) return

    const finalSlug = cleanSlug(slug)
    if (finalSlug.length < 3) {
      setError(t('slugHint'))
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
        setError(data.error ?? tc('importFailed'))
        setLoading(false)
        return
      }

      // Cookie is already set by the API — crawl step will use the new workspace
      setLoading(false)
      setStep('crawl')
    } catch {
      setError(tc('connectionError'))
      setLoading(false)
    }
  }

  function goToDashboard() {
    window.location.assign(`/${locale}/dashboard`)
  }

  if (step === 'crawl') {
    return (
      <div
        ref={backdropRef}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40"
      >
        <div className="bg-cream border border-border rounded-xl shadow-xl w-full max-w-md overflow-hidden">
          <div className="px-6 py-5">
            <CrawlStep onSkip={goToDashboard} onComplete={goToDashboard} compact />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-cream border border-border rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border">
          <h2 className="font-serif text-xl text-ink">{t('title')}</h2>
          <button
            onClick={onClose}
            className="text-muted hover:text-ink transition-colors p-1 rounded-md hover:bg-border/50"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div>
            <label htmlFor="ws-name" className="block text-xs font-medium text-ink mb-1.5">
              {t('helpCenterName')}
            </label>
            <input
              ref={nameInputRef}
              id="ws-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-white text-ink placeholder:text-muted focus:outline-none focus:border-ink text-sm transition-colors"
              placeholder={t('helpCenterNamePlaceholder')}
            />
          </div>

          <div>
            <label htmlFor="ws-slug" className="block text-xs font-medium text-ink mb-1.5">
              {t('urlSlug')}
            </label>
            <div className="flex items-center">
              {slugPrefix && (
                <span className="text-sm text-muted bg-white border border-border border-r-0 rounded-l-lg px-3 py-2 whitespace-nowrap">
                  {slugPrefix}
                </span>
              )}
              <input
                id="ws-slug"
                type="text"
                required
                value={slug}
                onChange={(e) => {
                  setSlug(slugify(e.target.value))
                  setSlugEdited(true)
                }}
                onBlur={() => setSlug(cleanSlug(slug))}
                className={`flex-1 min-w-0 px-3 py-2 border border-border bg-white text-ink placeholder:text-muted focus:outline-none focus:border-ink text-sm transition-colors ${
                  slugPrefix ? '' : 'rounded-l-lg'
                } ${slugSuffix ? '' : 'rounded-r-lg'}`}
                placeholder={t('slugPlaceholder')}
              />
              {slugSuffix && (
                <span className="text-sm text-muted bg-white border border-border border-l-0 rounded-r-lg px-3 py-2 whitespace-nowrap">
                  {slugSuffix}
                </span>
              )}
            </div>
            <p className="text-xs text-muted mt-1">{t('slugHint')}</p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-muted hover:text-ink transition-colors px-4 py-2 rounded-lg border border-border bg-white hover:bg-cream"
            >
              {tc('cancel')}
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim() || slug.trim().length < 3}
              className="bg-ink text-cream text-sm font-medium px-4 py-2 rounded-lg hover:bg-ink/90 transition-colors disabled:opacity-50"
            >
              {loading ? t('creating') : t('createButton')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
