'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'

interface Props {
  articleId: string
}

export function ArticleFeedback({ articleId }: Props) {
  const t = useTranslations('feedback')
  const [voted, setVoted] = useState<'helpful' | 'not' | null>(null)
  const storageKey = `helpnest-feedback:${articleId}`

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey)
      if (saved === 'helpful' || saved === 'not') {
        setVoted(saved)
      }
    } catch {}
  }, [storageKey])

  async function vote(type: 'helpful' | 'not') {
    if (voted) return
    setVoted(type)
    try {
      window.localStorage.setItem(storageKey, type)
    } catch {}

    await fetch(`/api/articles/${articleId}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type }),
    }).catch(() => {})
  }

  return (
    <div className="mt-12 p-6 bg-white rounded-xl border border-border text-center">
      {voted ? (
        <div>
          <p className="text-2xl mb-2">{voted === 'helpful' ? '🙏' : '😕'}</p>
          <p className="font-medium text-ink">{t('thanks')}</p>
          <p className="text-muted text-sm mt-1">
            {voted === 'helpful' ? t('gladHelped') : t('willImprove')}
          </p>
        </div>
      ) : (
        <div>
          <p className="font-medium text-ink mb-4">{t('wasHelpful')}</p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => vote('helpful')}
              className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm hover:border-green hover:text-green transition-colors"
            >
              {t('yesHelpful')}
            </button>
            <button
              onClick={() => vote('not')}
              className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm hover:border-accent hover:text-accent transition-colors"
            >
              {t('notReally')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
