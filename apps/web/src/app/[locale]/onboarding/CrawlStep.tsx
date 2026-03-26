'use client'

import { useState } from 'react'

type CrawlState = 'idle' | 'crawling' | 'done' | 'error'

interface CrawlResult {
  title: string
  articleId: string
  skipped: boolean
  skipReason?: string
}

export function CrawlStep({
  onSkip,
  onComplete,
}: {
  onSkip: () => void
  onComplete: () => void
}) {
  const [state, setState] = useState<CrawlState>('idle')
  const [url, setUrl] = useState('')
  const [urlError, setUrlError] = useState<string | null>(null)
  const [crawlError, setCrawlError] = useState<string | null>(null)
  const [result, setResult] = useState<CrawlResult | null>(null)

  function validateUrl(value: string): string | null {
    if (!value.trim()) return 'Please enter a URL.'
    try {
      const parsed = new URL(value.trim().startsWith('http') ? value.trim() : `https://${value.trim()}`)
      if (!['http:', 'https:'].includes(parsed.protocol)) return 'URL must start with http or https.'
      return null
    } catch {
      return 'Please enter a valid URL.'
    }
  }

  function normalizeUrl(value: string): string {
    const trimmed = value.trim()
    if (!trimmed) return trimmed
    if (/^https?:\/\//i.test(trimmed)) return trimmed
    return `https://${trimmed}`
  }

  async function handleGenerate() {
    const normalized = normalizeUrl(url)
    const error = validateUrl(normalized)
    if (error) {
      setUrlError(error)
      return
    }

    setUrlError(null)
    setCrawlError(null)
    setState('crawling')

    try {
      const res = await fetch('/api/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: normalized }),
      })

      const data = await res.json()

      if (!res.ok) {
        setCrawlError(data.error ?? 'Failed to generate articles. Please try again.')
        setState('error')
        return
      }

      if (data.skipped) {
        setCrawlError(
          data.skipReason
            ? `Page skipped: ${data.skipReason}`
            : 'No usable content found on that page. Try a different URL.',
        )
        setState('error')
        return
      }

      setResult({
        title: data.article?.title ?? 'Untitled Article',
        articleId: data.article?.id ?? '',
        skipped: false,
      })
      setState('done')
    } catch {
      setCrawlError('Network error. Please check your connection and try again.')
      setState('error')
    }
  }

  function handleCrawlAnother() {
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
    <main className="min-h-screen bg-cream flex items-center justify-center">
      <div className="w-full max-w-md px-6 py-10">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="font-serif text-3xl text-ink mb-2">Seed your help center</h1>
          <p className="text-muted text-sm">
            Enter your website URL and we&apos;ll generate help articles for you
          </p>
        </div>

        {/* Done state */}
        {state === 'done' && result && (
          <div className="mb-6 rounded-xl border border-green/30 bg-green/5 p-5">
            <div className="flex items-start gap-3">
              <span
                className="flex-shrink-0 mt-0.5 w-5 h-5 rounded-full bg-green flex items-center justify-center"
                aria-hidden="true"
              >
                <svg
                  className="w-3 h-3 text-white"
                  viewBox="0 0 12 12"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M2 6l3 3 5-5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">Article created</p>
                <p className="text-sm text-muted mt-0.5 truncate" title={result.title}>
                  {result.title}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Crawling state indicator */}
        {state === 'crawling' && (
          <div className="mb-6 rounded-xl border border-border bg-white p-5">
            <div className="flex items-center gap-3">
              <svg
                className="w-5 h-5 text-accent animate-spin flex-shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              <div>
                <p className="text-sm font-medium text-ink">Fetching &amp; generating&hellip;</p>
                <p className="text-xs text-muted mt-0.5">This usually takes 15&ndash;30 seconds</p>
              </div>
            </div>
          </div>
        )}

        {/* Error state */}
        {(state === 'error' || urlError) && (
          <p
            role="alert"
            className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2"
          >
            {crawlError ?? urlError}
          </p>
        )}

        {/* URL input — shown when not crawling or done with error */}
        {(state === 'idle' || state === 'error') && (
          <div className="space-y-3">
            <div>
              <label htmlFor="crawl-url" className="block text-sm font-medium text-ink mb-1.5">
                Website URL
              </label>
              <input
                id="crawl-url"
                type="url"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value)
                  if (urlError) setUrlError(null)
                }}
                onKeyDown={handleKeyDown}
                placeholder="https://yoursite.com/about"
                className="w-full px-3 py-2.5 border border-border rounded-lg bg-white text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent text-sm"
                aria-describedby={urlError ? 'url-error' : undefined}
              />
            </div>

            <button
              type="button"
              onClick={handleGenerate}
              disabled={!url.trim()}
              className="w-full bg-accent text-white py-2.5 px-4 rounded-lg hover:bg-accent/90 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Generate Articles
            </button>
          </div>
        )}

        {/* Post-success actions */}
        {state === 'done' && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleCrawlAnother}
              className="w-full border border-border bg-white text-ink py-2.5 px-4 rounded-lg hover:bg-cream transition-colors font-medium text-sm"
            >
              Crawl Another Page
            </button>

            <button
              type="button"
              onClick={onComplete}
              className="w-full bg-accent text-white py-2.5 px-4 rounded-lg hover:bg-accent/90 transition-colors font-medium"
            >
              Go to Dashboard
            </button>
          </div>
        )}

        {/* Skip link */}
        {state !== 'done' && (
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={onSkip}
              disabled={state === 'crawling'}
              className="text-sm text-muted hover:text-ink transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Skip and start from scratch
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
