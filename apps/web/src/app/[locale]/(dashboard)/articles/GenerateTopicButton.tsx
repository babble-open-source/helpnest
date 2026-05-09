'use client'

import { useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

export function GenerateTopicButton() {
  const router = useRouter()
  const t = useTranslations('generateTopic')
  const [open, setOpen] = useState(false)
  const [topic, setTopic] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ articleId: string; title: string } | null>(null)

  async function handleGenerate() {
    const trimmed = topic.trim()
    if (!trimmed) return

    setLoading(true)
    setError(null)
    setResult(null)

    // Fresh UUID per click — prevents double-submit without creating a 24h cache
    // that would block the user from regenerating the same topic intentionally
    const idempotencyKey = crypto.randomUUID()

    try {
      const res = await fetch('/api/ai/generate-article', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: trimmed.slice(0, 500), idempotencyKey }),
      })

      if (res.status === 429) {
        setError(t('rateLimited'))
        return
      }

      if (!res.ok) {
        const text = await res.text().catch(() => `HTTP ${res.status}`)
        setError(text || 'Something went wrong. Please try again.')
        return
      }

      const data = (await res.json()) as { articleId: string; title: string; mode: string }
      setResult({ articleId: data.articleId, title: data.title })
      setTopic('')
      router.refresh()
    } catch {
      setError('Failed to connect. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    setOpen(false)
    setTopic('')
    setError(null)
    setResult(null)
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="shrink-0"
      >
        {t('generate')}
      </Button>

      <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose() }}>
        <DialogContent className="dashboard-root sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-sans text-base font-medium tracking-normal text-foreground">
              {t('dialogTitle')}
            </DialogTitle>
            <DialogDescription className="font-sans text-sm text-muted-foreground">
              {t('dialogDescription') ?? 'Enter a topic and we\'ll generate a draft article for you.'}
            </DialogDescription>
          </DialogHeader>

          {result ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm font-medium text-emerald-600">{t('draftCreated')}</p>
              <a
                href={`/articles/${result.articleId}/edit`}
                className="text-sm text-primary hover:underline truncate"
              >
                {result.title} →
              </a>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => { setResult(null); setTopic('') }}
                >
                  {t('generateAnother')}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <Input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !loading && handleGenerate()}
                placeholder={t('placeholder')}
                autoFocus
                disabled={loading}
              />

              {error && (
                <p className="text-xs text-destructive">{error}</p>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={handleClose}>
                  {t('cancel')}
                </Button>
                <Button
                  onClick={handleGenerate}
                  disabled={loading || !topic.trim()}
                >
                  {loading ? t('generating') : t('generateButton')}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
