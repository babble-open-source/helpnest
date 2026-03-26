'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'

interface Props {
  workspace: { id: string; name: string; deletedAt: string | null }
  cloudMode: boolean
  onClose: () => void
  onSuccess: () => void
}

export function RestoreModal({ workspace, cloudMode, onClose, onSuccess }: Props) {
  const t = useTranslations('workspaces')
  const tc = useTranslations('common')

  const [slugState, setSlugState] = useState<'loading' | 'available' | 'claimed'>('loading')
  const [currentSlug, setCurrentSlug] = useState('')
  const [newSlug, setNewSlug] = useState('')
  const [restoring, setRestoring] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function checkSlug() {
      try {
        const res = await fetch(`/api/workspaces/restore/check-slug?workspaceId=${workspace.id}`)
        if (!res.ok) {
          const data = await res.json() as { error?: string }
          if (res.status === 410) {
            setError(t('restoreExpired'))
          } else {
            setError(data.error ?? tc('somethingWentWrong'))
          }
          return
        }
        const data = await res.json() as { available: boolean; slug: string; originalSlug?: string }
        if (cancelled) return
        setCurrentSlug(data.slug)
        if (data.available) {
          setSlugState('available')
        } else {
          setSlugState('claimed')
          setNewSlug(data.originalSlug ?? '')
        }
      } catch {
        if (!cancelled) setError(tc('somethingWentWrong'))
      }
    }
    checkSlug()
    return () => { cancelled = true }
  }, [workspace.id, t, tc])

  async function handleRestore() {
    setRestoring(true)
    setError('')
    try {
      const body: { workspaceId: string; slug?: string } = { workspaceId: workspace.id }
      if (slugState === 'claimed' && newSlug.trim()) {
        body.slug = newSlug.trim()
      }

      const res = await fetch('/api/workspaces/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json() as { error?: string }
        if (data.error === 'slugRequired') {
          setSlugState('claimed')
          setError(t('restoreSlugRequired'))
        } else if (res.status === 410) {
          setError(t('restoreExpired'))
        } else if (res.status === 409) {
          setError(t('restoreSlugTaken'))
        } else {
          setError(data.error ?? tc('somethingWentWrong'))
        }
        return
      }

      // Trigger embedding re-sync as a separate request for reliability.
      // The server also fires this, but in serverless environments that
      // fire-and-forget may be killed — this client-side call ensures it runs.
      fetch('/api/embeddings/sync', { method: 'POST' }).catch(() => {})

      onSuccess()
    } catch {
      setError(tc('somethingWentWrong'))
    } finally {
      setRestoring(false)
    }
  }

  const canSubmit =
    !restoring &&
    !error.includes(t('restoreExpired')) &&
    slugState !== 'loading' &&
    (slugState === 'available' || newSlug.trim().length >= 3)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40" onClick={onClose}>
      <div
        className="bg-white rounded-xl border border-border shadow-lg p-6 max-w-md mx-4 w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-serif text-lg text-ink mb-2">{t('restoreTitle')}</h3>
        <p className="text-sm text-muted mb-4">
          <span className="font-medium text-ink">{workspace.name}</span>
        </p>

        {slugState === 'loading' && !error && (
          <p className="text-sm text-muted mb-4">…</p>
        )}

        {slugState === 'claimed' && (
          <div className="mb-4">
            <p className="text-sm text-muted mb-2">{t('restoreSlugClaimed')}</p>
            <input
              type="text"
              value={newSlug}
              onChange={(e) => { setNewSlug(e.target.value); setError('') }}
              placeholder={t('restoreSlugPlaceholder')}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
        )}

        <div className="space-y-1.5 mb-4 text-xs text-muted">
          <p>{t('restoreAiReindex')}</p>
          <p>{t('restoreDomainNote')}</p>
          {cloudMode && <p>{t('restoreBillingNote')}</p>}
        </div>

        {error && <p className="text-sm text-red-500 mb-3">{error}</p>}

        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-medium px-4 py-2 rounded-lg border border-border text-ink hover:bg-cream transition-colors"
          >
            {tc('cancel')}
          </button>
          <button
            type="button"
            onClick={handleRestore}
            disabled={!canSubmit}
            className="text-sm font-medium px-4 py-2 rounded-lg bg-ink text-cream hover:bg-ink/90 transition-colors disabled:opacity-50"
          >
            {restoring ? t('restoring') : t('restoreConfirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
