'use client'

import { useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
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
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('dialogTitle')}</DialogTitle>
          </DialogHeader>

          {result ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">{t('draftCreated')}</p>
              <a
                href={`/dashboard/articles/${result.articleId}/edit`}
                className="text-sm text-orange-500 hover:underline truncate"
              >
                {result.title} →
              </a>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setResult(null); setTopic('') }}
                className="self-start h-auto p-0 text-muted-foreground hover:text-foreground"
              >
                {t('generateAnother')}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !loading && handleGenerate()}
                  placeholder={t('placeholder')}
                  autoFocus
                  disabled={loading}
                  className="flex-1"
                />
                <Button
                  onClick={handleGenerate}
                  disabled={loading || !topic.trim()}
                  size="sm"
                  className="shrink-0"
                >
                  {loading ? t('generating') : t('generateButton')}
                </Button>
              </div>

              {error && (
                <p className="text-xs text-destructive">{error}</p>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={handleClose}
                className="self-start h-auto p-0 text-muted-foreground hover:text-foreground"
              >
                {t('cancel')}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
