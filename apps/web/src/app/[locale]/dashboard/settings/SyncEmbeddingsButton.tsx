'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

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
        <button
          onClick={sync}
          disabled={status === 'syncing'}
          className="bg-green text-white px-4 py-2 rounded-lg text-sm hover:bg-green/90 transition-colors disabled:opacity-50"
        >
          {status === 'syncing' ? t('syncing') : t('syncButton')}
        </button>
        {status === 'done' && result && (
          <span className="text-sm text-green-700">
            {t('syncResult', { articles: result.articles, chunks: result.points })}
          </span>
        )}
        {status === 'error' && (
          <span className="text-sm text-red-600">{t('syncFailed')}</span>
        )}
      </div>
      <p className="text-xs text-muted mt-1">
        {t('syncHelp')}
      </p>
    </div>
  )
}
