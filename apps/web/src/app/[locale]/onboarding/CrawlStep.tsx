'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { AiCreditsIndicator } from '@/components/AiCreditsIndicator'

type CrawlState = 'idle' | 'crawling' | 'done' | 'error'

interface CrawlResult {
  title: string
  articleId: string
  skipped: boolean
  skipReason?: string
}

interface CreditsInfo {
  used: number
  limit: number
  remaining: number
  hasOwnKey: boolean
}

export function CrawlStep({
  onSkip,
  onComplete,
  compact = false,
}: {
  onSkip: () => void
  onComplete: () => void
  compact?: boolean
}) {
  const t = useTranslations('crawl')
  const [state, setState] = useState<CrawlState>('idle')
  const [goal, setGoal] = useState('')
  const [url, setUrl] = useState('')
  const [urlError, setUrlError] = useState<string | null>(null)
  const [crawlError, setCrawlError] = useState<string | null>(null)
  const [result, setResult] = useState<CrawlResult | null>(null)
  const [credits, setCredits] = useState<CreditsInfo | null>(null)

  useEffect(() => {
    fetch('/api/crawl/credits')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: CreditsInfo | null) => { if (data) setCredits(data) })
      .catch(() => {/* credits display is non-critical */})
  }, [])

  function normalizeUrl(value: string): string {
    const trimmed = value.trim()
    if (!trimmed) return trimmed
    if (/^https?:\/\//i.test(trimmed)) return trimmed
    return `https://${trimmed}`
  }

  async function handleGenerate() {
    const normalized = normalizeUrl(url)
    if (!normalized) {
      setUrlError(t('pageUrl'))
      return
    }

    setUrlError(null)
    setCrawlError(null)
    setState('crawling')

    try {
      const res = await fetch('/api/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: normalized, goal: goal.trim() }),
      })

      const data = await res.json()

      if (!res.ok) {
        setCrawlError(data.error ?? t('importFailed'))
        setState('error')
        return
      }

      if (data.mode === 'discovery') {
        setCrawlError('This needs more pages than a quick import. Try the full Import tool from the dashboard after setup.')
        setState('error')
        return
      }

      if (data.skipped) {
        setCrawlError(data.skipReason ?? t('pageSkippedDefault'))
        setState('error')
        return
      }

      if (data.credits) {
        setCredits((prev) =>
          prev
            ? { ...prev, used: data.credits.used, limit: data.credits.limit, remaining: data.credits.remaining }
            : prev
        )
      }

      setResult({
        title: data.article?.title ?? 'Untitled Article',
        articleId: data.article?.id ?? '',
        skipped: false,
      })
      setState('done')
    } catch {
      setCrawlError(t('connectionError'))
      setState('error')
    }
  }

  function handleCrawlAnother() {
    setGoal('')
    setUrl('')
    setUrlError(null)
    setCrawlError(null)
    setResult(null)
    setState('idle')
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (state !== 'crawling') handleGenerate()
    }
  }

  return (
    <div className={compact ? '' : 'min-h-screen bg-cream flex items-center justify-center'}>
      <div className={compact ? 'w-full' : 'w-full max-w-md px-6 py-10'}>
        <div className="text-center mb-8">
          <h1 className={`font-serif text-ink mb-2 ${compact ? 'text-xl' : 'text-3xl'}`}>{t('seedTitle')}</h1>
          <p className="text-muted text-sm">{t('seedDescription')}</p>
        </div>

        {state === 'done' && result && (
          <div className="mb-6 rounded-xl border border-green/30 bg-green/5 p-5">
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 mt-0.5 w-5 h-5 rounded-full bg-green flex items-center justify-center" aria-hidden="true">
                <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">{t('articleCreated')}</p>
                <p className="text-sm text-muted mt-0.5 truncate" title={result.title}>{result.title}</p>
              </div>
            </div>
          </div>
        )}

        {state === 'crawling' && (
          <div className="mb-6 rounded-xl border border-border bg-white p-5">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-accent animate-spin flex-shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-ink">{t('generating')}</p>
                <p className="text-xs text-muted mt-0.5">{t('crawlingHelp')}</p>
              </div>
            </div>
          </div>
        )}

        {(state === 'error' || urlError) && (
          <p role="alert" className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {crawlError ?? urlError}
          </p>
        )}

        {(state === 'idle' || state === 'error') && (() => {
          const creditsExhausted = credits !== null && credits.limit !== -1 && credits.remaining === 0
          return (
            <div className="space-y-3">
              {creditsExhausted ? (
                <p className="text-sm text-muted bg-white border border-border rounded-lg px-4 py-3 text-center">
                  {"You've used all free articles. You can add your AI key in Settings later."}
                </p>
              ) : (
                <>
                  <div>
                    <label htmlFor="crawl-goal" className="block text-sm font-medium text-ink mb-1.5">
                      {t('goalLabel')}
                    </label>
                    <input
                      id="crawl-goal"
                      type="text"
                      value={goal}
                      onChange={(e) => setGoal(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={t('goalPlaceholder')}
                      className="w-full px-3 py-2.5 border border-border rounded-lg bg-white text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="crawl-url" className="block text-sm font-medium text-ink mb-1.5">
                      {t('urlLabel')}
                    </label>
                    <input
                      id="crawl-url"
                      type="url"
                      value={url}
                      onChange={(e) => { setUrl(e.target.value); if (urlError) setUrlError(null) }}
                      onKeyDown={handleKeyDown}
                      placeholder={t('urlPlaceholder')}
                      className="w-full px-3 py-2.5 border border-border rounded-lg bg-white text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent text-sm"
                    />
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={handleGenerate}
                      disabled={!goal.trim() || !url.trim()}
                      className="w-full bg-accent text-white py-2.5 px-4 rounded-lg hover:bg-accent/90 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {t('generateButton')}
                    </button>
                    {credits !== null && (
                      <div className="mt-2 text-center">
                        <AiCreditsIndicator
                          used={credits.used}
                          limit={credits.limit}
                          remaining={credits.remaining}
                        />
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )
        })()}

        {state === 'done' && (
          <div className="space-y-3">
            {(credits === null || credits.limit === -1 || credits.remaining > 0) && (
              <button type="button" onClick={handleCrawlAnother} className="w-full border border-border bg-white text-ink py-2.5 px-4 rounded-lg hover:bg-cream transition-colors font-medium text-sm">
                {t('crawlAnother')}
              </button>
            )}
            {credits !== null && credits.limit !== -1 && credits.remaining === 0 && (
              <p className="text-xs text-muted text-center">
                {"You've used all free articles. You can add your AI key in Settings later."}
              </p>
            )}
            <button type="button" onClick={onComplete} className="w-full bg-accent text-white py-2.5 px-4 rounded-lg hover:bg-accent/90 transition-colors font-medium">
              {t('goToDashboard')}
            </button>
          </div>
        )}

        {state !== 'done' && (
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={onSkip}
              disabled={state === 'crawling'}
              className="text-sm text-muted hover:text-ink transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {t('skipLink')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
