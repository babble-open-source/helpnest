'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

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
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('restoreTitle')}</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{workspace.name}</span>
        </p>

        {slugState === 'loading' && !error && (
          <p className="text-sm text-muted-foreground">…</p>
        )}

        {slugState === 'claimed' && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{t('restoreSlugClaimed')}</p>
            <Input
              type="text"
              value={newSlug}
              onChange={(e) => { setNewSlug(e.target.value); setError('') }}
              placeholder={t('restoreSlugPlaceholder')}
            />
          </div>
        )}

        <div className="space-y-1.5 text-xs text-muted-foreground">
          <p>{t('restoreAiReindex')}</p>
          <p>{t('restoreDomainNote')}</p>
          {cloudMode && <p>{t('restoreBillingNote')}</p>}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button
            type="button"
            onClick={onClose}
            variant="outline"
          >
            {tc('cancel')}
          </Button>
          <Button
            type="button"
            onClick={handleRestore}
            disabled={!canSubmit}
          >
            {restoring ? t('restoring') : t('restoreConfirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
