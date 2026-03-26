'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from '@/i18n/navigation'

interface CrawlResult {
  crawlJobId: string
  skipped: boolean
  skipReason?: string
  article?: {
    id: string
    title: string
    slug: string
    collectionId: string
    excerpt?: string
    confidence: number
  }
  contentType?: string
  sensitiveDataWarnings?: string[]
}

interface Collection {
  id: string
  title: string
}

type ModalState = 'idle' | 'crawling' | 'done' | 'error'

export function CrawlModal({
  collections,
  onClose,
  onSuccess,
}: {
  collections: Collection[]
  onClose: () => void
  onSuccess: () => void
}) {
  const router = useRouter()
  const [state, setState] = useState<ModalState>('idle')
  const [url, setUrl] = useState('')
  const [collectionId, setCollectionId] = useState('')
  const [result, setResult] = useState<CrawlResult | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const urlInputRef = useRef<HTMLInputElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)

  // Auto-focus URL input on open
  useEffect(() => {
    urlInputRef.current?.focus()
  }, [])

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === backdropRef.current) onClose()
  }

  async function handleCrawl() {
    const trimmedUrl = url.trim()
    if (!trimmedUrl) return

    setState('crawling')
    setErrorMessage('')
    setResult(null)

    try {
      const res = await fetch('/api/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: trimmedUrl,
          ...(collectionId ? { collectionId } : {}),
        }),
      })

      const data = (await res.json()) as CrawlResult & { error?: string }

      if (!res.ok) {
        setErrorMessage(data.error ?? `Request failed (HTTP ${res.status})`)
        setState('error')
        return
      }

      setResult(data)
      setState('done')
      onSuccess()
      router.refresh()
    } catch {
      setErrorMessage('Failed to connect. Please check your connection and try again.')
      setState('error')
    }
  }

  function handleReset() {
    setState('idle')
    setUrl('')
    setCollectionId('')
    setResult(null)
    setErrorMessage('')
    setTimeout(() => urlInputRef.current?.focus(), 0)
  }

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label="Import from Website"
    >
      <div className="bg-cream border border-border rounded-xl shadow-xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border">
          <h2 className="font-serif text-xl text-ink">Import from Website</h2>
          <button
            onClick={onClose}
            className="text-muted hover:text-ink transition-colors p-1 rounded-md hover:bg-border/50"
            aria-label="Close modal"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M2 2l12 12M14 2L2 14"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {state === 'idle' && (
            <IdleState
              url={url}
              onUrlChange={setUrl}
              collectionId={collectionId}
              onCollectionChange={setCollectionId}
              collections={collections}
              onSubmit={handleCrawl}
              onCancel={onClose}
              urlInputRef={urlInputRef}
            />
          )}

          {state === 'crawling' && <CrawlingState />}

          {state === 'done' && result && (
            <DoneState result={result} onImportAnother={handleReset} onClose={onClose} />
          )}

          {state === 'error' && (
            <ErrorState message={errorMessage} onRetry={handleReset} onClose={onClose} />
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Idle state — URL input + collection picker + extension nudge
// ---------------------------------------------------------------------------

function IdleState({
  url,
  onUrlChange,
  collectionId,
  onCollectionChange,
  collections,
  onSubmit,
  onCancel,
  urlInputRef,
}: {
  url: string
  onUrlChange: (v: string) => void
  collectionId: string
  onCollectionChange: (v: string) => void
  collections: Collection[]
  onSubmit: () => void
  onCancel: () => void
  urlInputRef: React.RefObject<HTMLInputElement | null>
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted leading-relaxed">
        Paste a public URL and HelpNest will fetch the page, extract its content, and generate a
        help article draft using AI.
      </p>

      {/* URL input */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="crawl-url" className="text-xs font-medium text-ink">
          Page URL
        </label>
        <input
          ref={urlInputRef}
          id="crawl-url"
          type="url"
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && url.trim() && onSubmit()}
          placeholder="https://example.com/support/getting-started"
          className="w-full text-sm bg-white border border-border rounded-lg px-3 py-2 outline-none focus:border-ink text-ink placeholder:text-muted transition-colors"
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      {/* Collection picker */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="crawl-collection" className="text-xs font-medium text-ink">
          Add to collection{' '}
          <span className="text-muted font-normal">(optional)</span>
        </label>
        <select
          id="crawl-collection"
          value={collectionId}
          onChange={(e) => onCollectionChange(e.target.value)}
          className="w-full text-sm bg-white border border-border rounded-lg px-3 py-2 outline-none focus:border-ink text-ink transition-colors"
        >
          <option value="">Auto-organize (AI picks the best collection)</option>
          {collections.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </div>

      {/* Extension nudge */}
      <div className="bg-white border border-border rounded-lg px-4 py-3 text-xs text-muted leading-relaxed">
        <span className="font-medium text-ink">Want to import pages behind login?</span>{' '}
        Our Chrome Extension lets you capture authenticated pages.{' '}
        <span className="text-accent font-medium">Coming soon.</span>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-muted hover:text-ink transition-colors px-4 py-2 rounded-lg border border-border bg-white hover:bg-cream"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!url.trim()}
          className="bg-accent text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Import
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Crawling state — spinner
// ---------------------------------------------------------------------------

function CrawlingState() {
  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <div
        className="w-8 h-8 border-2 border-border border-t-accent rounded-full animate-spin"
        aria-hidden="true"
      />
      <div className="text-center">
        <p className="text-sm font-medium text-ink">Fetching and analyzing page...</p>
        <p className="text-xs text-muted mt-1">This usually takes 10–30 seconds</p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Done state — success or skipped
// ---------------------------------------------------------------------------

function DoneState({
  result,
  onImportAnother,
  onClose,
}: {
  result: CrawlResult
  onImportAnother: () => void
  onClose: () => void
}) {
  if (result.skipped) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3 bg-white border border-border rounded-lg px-4 py-3">
          <span className="text-base mt-0.5" aria-hidden="true">&#9888;&#65039;</span>
          <div>
            <p className="text-sm font-medium text-ink">Page skipped</p>
            <p className="text-xs text-muted mt-0.5">
              {result.skipReason ??
                'The page did not contain enough content to generate an article.'}
            </p>
          </div>
        </div>

        {result.sensitiveDataWarnings && result.sensitiveDataWarnings.length > 0 && (
          <SensitiveDataWarnings warnings={result.sensitiveDataWarnings} />
        )}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onImportAnother}
            className="text-sm text-muted hover:text-ink transition-colors px-4 py-2 rounded-lg border border-border bg-white hover:bg-cream"
          >
            Try another URL
          </button>
          <button
            type="button"
            onClick={onClose}
            className="bg-ink text-cream text-sm font-medium px-4 py-2 rounded-lg hover:bg-ink/90 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3 bg-white border border-border rounded-lg px-4 py-3">
        <span className="text-base mt-0.5 text-green-700" aria-hidden="true">&#10003;</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink">Draft article created</p>
          {result.article && (
            <a
              href={`/dashboard/articles/${result.article.id}/edit`}
              className="text-sm text-accent hover:underline truncate block mt-0.5"
            >
              {result.article.title} &rarr;
            </a>
          )}
          {result.article?.confidence != null && (
            <p className="text-xs text-muted mt-1">
              Confidence: {Math.round(result.article.confidence * 100)}%
              {result.contentType && (
                <span className="ml-2 capitalize">
                  {result.contentType.replace(/_/g, ' ')}
                </span>
              )}
            </p>
          )}
        </div>
      </div>

      {result.sensitiveDataWarnings && result.sensitiveDataWarnings.length > 0 && (
        <SensitiveDataWarnings warnings={result.sensitiveDataWarnings} />
      )}

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onImportAnother}
          className="text-sm text-muted hover:text-ink transition-colors px-4 py-2 rounded-lg border border-border bg-white hover:bg-cream"
        >
          Import another
        </button>
        <button
          type="button"
          onClick={onClose}
          className="bg-ink text-cream text-sm font-medium px-4 py-2 rounded-lg hover:bg-ink/90 transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

function ErrorState({
  message,
  onRetry,
  onClose,
}: {
  message: string
  onRetry: () => void
  onClose: () => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3 bg-white border border-red-200 rounded-lg px-4 py-3">
        <span className="text-base mt-0.5 text-red-500" aria-hidden="true">&#x2715;</span>
        <div>
          <p className="text-sm font-medium text-ink">Import failed</p>
          <p className="text-xs text-muted mt-0.5 break-words">{message}</p>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="text-sm text-muted hover:text-ink transition-colors px-4 py-2 rounded-lg border border-border bg-white hover:bg-cream"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onRetry}
          className="bg-accent text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-accent/90 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shared: sensitive data warning banner
// ---------------------------------------------------------------------------

function SensitiveDataWarnings({ warnings }: { warnings: string[] }) {
  return (
    <div className="flex items-start gap-3 bg-white border border-amber-200 rounded-lg px-4 py-3">
      <span className="text-base mt-0.5 text-amber-500" aria-hidden="true">&#9888;</span>
      <div>
        <p className="text-xs font-medium text-ink">
          Sensitive data detected — review before publishing
        </p>
        <ul className="mt-1 space-y-0.5">
          {warnings.map((w) => (
            <li key={w} className="text-xs text-muted">
              {w}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
