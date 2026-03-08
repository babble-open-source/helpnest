'use client'

import { useState } from 'react'

interface Props {
  articleId: string
}

export function ArticleFeedback({ articleId }: Props) {
  const [voted, setVoted] = useState<'helpful' | 'not' | null>(null)

  async function vote(type: 'helpful' | 'not') {
    if (voted) return
    setVoted(type)
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
          <p className="font-medium text-ink">Thanks for your feedback!</p>
          <p className="text-muted text-sm mt-1">
            {voted === 'helpful'
              ? 'Glad this article helped.'
              : 'We\'ll work on improving this article.'}
          </p>
        </div>
      ) : (
        <div>
          <p className="font-medium text-ink mb-4">Was this article helpful?</p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => vote('helpful')}
              className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm hover:border-green hover:text-green transition-colors"
            >
              <span>👍</span> Yes, helpful
            </button>
            <button
              onClick={() => vote('not')}
              className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm hover:border-accent hover:text-accent transition-colors"
            >
              <span>👎</span> Not really
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
