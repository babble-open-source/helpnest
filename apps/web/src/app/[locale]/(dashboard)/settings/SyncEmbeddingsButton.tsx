'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'

interface Props {
  workspaceId: string
}

export function SyncEmbeddingsButton({ workspaceId }: Props) {
  const t = useTranslations('sync')
  const [status, setStatus] = useState<'idle' | 'syncing' | 'done' | 'error'>('idle')
  const [result, setResult] = useState<{ articles: number; points: number } | null>(null)

  async function sync() {
    setStatus('syncing')
    setResult(null)
    try {
      const res = await fetch('/api/embeddings/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId }),
      })
      const data = await res.json() as { articles: number; points: number }
      setResult(data)
      setStatus('done')
    } catch {
      setStatus('error')
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <Button
          onClick={sync}
          disabled={status === 'syncing'}
          variant="default"
        >
          {status === 'syncing' ? t('syncing') : t('syncButton')}
        </Button>
        {status === 'done' && result && (
          <span className="text-sm text-emerald-600 dark:text-emerald-400">
            {t('syncResult', { articles: result.articles, chunks: result.points })}
          </span>
        )}
        {status === 'error' && (
          <span className="text-sm text-destructive">{t('syncFailed')}</span>
        )}
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        {t('syncHelp')}
      </p>
    </div>
  )
}
