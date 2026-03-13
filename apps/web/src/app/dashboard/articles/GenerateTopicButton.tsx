'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function GenerateTopicButton() {
  const router = useRouter()
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
        setError('Draft limit reached (20/hr). Try again after the hour resets.')
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

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="border border-border text-ink px-3 sm:px-4 py-2 rounded-lg text-sm hover:bg-cream transition-colors font-medium shrink-0"
      >
        + Generate from topic
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-2 bg-cream border border-border rounded-xl p-4 w-full sm:w-auto sm:min-w-80">
      <p className="text-xs font-medium text-muted">Generate article from topic</p>

      {result ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-green font-medium">Draft created</p>
          <a
            href={`/dashboard/articles/${result.articleId}/edit`}
            className="text-sm text-accent hover:underline truncate"
          >
            {result.title} →
          </a>
          <button
            onClick={handleClose}
            className="text-xs text-muted hover:text-ink transition-colors text-left"
          >
            Generate another
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !loading && handleGenerate()}
              placeholder="e.g. Setting up SSO"
              className="flex-1 text-sm bg-white border border-border rounded-lg px-3 py-1.5 outline-none focus:border-ink text-ink placeholder:text-muted"
              autoFocus
              disabled={loading}
            />
            <button
              onClick={handleGenerate}
              disabled={loading || !topic.trim()}
              className="bg-ink text-cream px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-ink/90 transition-colors shrink-0"
            >
              {loading ? 'Generating...' : 'Generate'}
            </button>
          </div>

          {error && (
            <p className="text-xs text-red-500">{error}</p>
          )}

          <button
            onClick={handleClose}
            className="text-xs text-muted hover:text-ink transition-colors text-left"
          >
            Cancel
          </button>
        </>
      )}
    </div>
  )
}
