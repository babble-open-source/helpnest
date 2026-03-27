'use client'

import { useState, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { SensitiveDataWarnings } from './CrawlModal'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PageStatus = 'GENERATED' | 'PENDING' | 'FAILED' | 'SKIPPED'
type JobStatus =
  | 'PENDING'
  | 'CRAWLING'
  | 'EXTRACTING'
  | 'GENERATING'
  | 'COMPLETED'
  | 'FAILED'

interface CrawlPageResult {
  id: string
  url: string
  status: PageStatus
  contentType?: string | null
  skipReason?: string | null
  articleId?: string | null
  similarArticleId?: string | null
  article?: {
    id: string
    title: string
    slug: string
    excerpt?: string | null
  } | null
}

interface CrawlStatusResponse {
  id: string
  status: JobStatus
  mode: string
  goalPrompt?: string | null
  sourceUrl?: string | null
  totalPages: number
  processedPages: number
  articlesCreated: number
  error?: string | null
  createdAt: string
  completedAt?: string | null
  pages: CrawlPageResult[]
  summary: {
    generated: number
    skipped: number
    failed: number
    pending: number
  }
}

// ---------------------------------------------------------------------------
// Status icon
// ---------------------------------------------------------------------------

function PageStatusIcon({ status }: { status: PageStatus }) {
  if (status === 'GENERATED') {
    return (
      <svg
        className="text-green shrink-0"
        width="14"
        height="14"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M3 8l3.5 3.5L13 4"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }
  if (status === 'FAILED') {
    return (
      <svg
        className="text-red-500 shrink-0"
        width="14"
        height="14"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M4 4l8 8M12 4L4 12"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      </svg>
    )
  }
  if (status === 'SKIPPED') {
    return (
      <svg
        className="text-muted shrink-0"
        width="14"
        height="14"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M4 8h8"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      </svg>
    )
  }
  // PENDING
  return (
    <svg
      className="text-border shrink-0"
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Progress bar
// ---------------------------------------------------------------------------

function ProgressBar({ value, total }: { value: number; total: number }) {
  const percent = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0
  return (
    <div className="w-full bg-border rounded-full h-2 overflow-hidden">
      <div
        className="bg-accent h-2 rounded-full transition-all duration-500"
        style={{ width: `${percent}%` }}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={`${percent}% complete`}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// CrawlProgress
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 3000
const TERMINAL_STATUSES: JobStatus[] = ['COMPLETED', 'FAILED']

export function CrawlProgress({
  crawlJobId,
  onComplete,
  onClose,
  onImportAnother,
}: {
  crawlJobId: string
  onComplete: () => void
  onImportAnother: () => void
  onClose: () => void
}) {
  const t = useTranslations('crawl')
  const [data, setData] = useState<CrawlStatusResponse | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const completedRef = useRef(false)

  const isTerminal = data ? TERMINAL_STATUSES.includes(data.status) : false

  useEffect(() => {
    async function poll() {
      try {
        const res = await fetch(`/api/crawl/status/${crawlJobId}`)
        if (!res.ok) {
          const body = (await res.json()) as { error?: string }
          setFetchError(body.error ?? `HTTP ${res.status}`)
          return
        }
        const json = (await res.json()) as CrawlStatusResponse
        setData(json)

        if (TERMINAL_STATUSES.includes(json.status) && !completedRef.current) {
          completedRef.current = true
          if (intervalRef.current) clearInterval(intervalRef.current)
          onComplete()
        }
      } catch {
        setFetchError('Failed to fetch crawl status. Retrying...')
      }
    }

    // Poll immediately on mount, then on interval
    void poll()
    intervalRef.current = setInterval(() => void poll(), POLL_INTERVAL_MS)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    // onComplete is intentionally excluded from deps — it's a callback that shouldn't restart polling
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crawlJobId])

  // Collect all unique sensitive warnings from pages
  const sensitiveWarnings = data
    ? Array.from(
        new Set(
          data.pages
            .filter((p) => p.skipReason?.toLowerCase().includes('pii') ||
              p.skipReason?.toLowerCase().includes('sensitive'))
            .map((p) => p.skipReason!)
        )
      )
    : []

  if (fetchError && !data) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3 bg-white border border-red-200 rounded-lg px-4 py-3">
          <span className="text-red-500 text-base mt-0.5" aria-hidden="true">
            &#x2715;
          </span>
          <p className="text-sm text-muted">{fetchError}</p>
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-muted hover:text-ink transition-colors px-4 py-2 rounded-lg border border-border bg-white hover:bg-cream"
          >
            {t('cancel')}
          </button>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <div
          className="w-8 h-8 border-2 border-border border-t-accent rounded-full animate-spin"
          aria-hidden="true"
        />
        <p className="text-sm text-muted">{t('loading')}</p>
      </div>
    )
  }

  const { totalPages, processedPages, summary } = data
  const progressLabel = isTerminal ? t('progressComplete') : t('progressTitle')

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-ink">{progressLabel}</p>
          {!isTerminal && (
            <div
              className="w-4 h-4 border-2 border-border border-t-accent rounded-full animate-spin"
              aria-hidden="true"
            />
          )}
        </div>
        <p className="text-xs text-muted">
          {t('progressDescription', { processed: processedPages, total: totalPages })}
        </p>
      </div>

      {/* Progress bar */}
      <ProgressBar value={processedPages} total={totalPages} />

      {/* Pages list */}
      <div className="bg-white border border-border rounded-lg divide-y divide-border max-h-64 overflow-y-auto">
        {data.pages.length === 0 ? (
          <p className="px-4 py-6 text-xs text-muted text-center">Waiting for pages...</p>
        ) : (
          data.pages.map((page) => (
            <div key={page.id} className="flex items-start gap-3 px-4 py-3">
              <div className="mt-0.5">
                <PageStatusIcon status={page.status} />
              </div>
              <div className="min-w-0 flex-1">
                {page.article ? (
                  <a
                    href={`/dashboard/articles/${page.article.id}/edit`}
                    className="text-sm text-accent hover:underline truncate block"
                  >
                    {page.article.title}
                  </a>
                ) : (
                  <p className="text-sm text-ink truncate">{page.url}</p>
                )}
                {page.status === 'SKIPPED' && page.skipReason && (
                  <p className="text-xs text-muted mt-0.5 truncate">{page.skipReason}</p>
                )}
                {page.status === 'FAILED' && page.skipReason && (
                  <p className="text-xs text-red-500 mt-0.5 truncate">{page.skipReason}</p>
                )}
                {page.article?.excerpt && (
                  <p className="text-xs text-muted mt-0.5 truncate">{page.article.excerpt}</p>
                )}
              </div>
              <StatusLabel status={page.status} />
            </div>
          ))
        )}
      </div>

      {/* Sensitive data warnings */}
      {sensitiveWarnings.length > 0 && <SensitiveDataWarnings warnings={sensitiveWarnings} />}

      {/* Job-level error */}
      {data.error && (
        <div className="flex items-start gap-3 bg-white border border-red-200 rounded-lg px-4 py-3">
          <span className="text-red-500 text-base mt-0.5" aria-hidden="true">
            &#x2715;
          </span>
          <p className="text-xs text-muted break-words">{data.error}</p>
        </div>
      )}

      {/* Completion summary */}
      {isTerminal && (
        <div className="bg-white border border-border rounded-lg px-4 py-3">
          <p className="text-xs text-muted">
            {t('progressCompleteDescription', {
              generated: summary.generated,
              skipped: summary.skipped,
              failed: summary.failed,
            })}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-1">
        {isTerminal ? (
          <>
            <button
              type="button"
              onClick={onImportAnother}
              className="text-sm text-muted hover:text-ink transition-colors px-4 py-2 rounded-lg border border-border bg-white hover:bg-cream"
            >
              {t('importAnotherUrl')}
            </button>
            <a
              href="/dashboard/articles"
              className="bg-ink text-cream text-sm font-medium px-4 py-2 rounded-lg hover:bg-ink/90 transition-colors"
            >
              {t('viewAllArticles')}
            </a>
          </>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-muted hover:text-ink transition-colors px-4 py-2 rounded-lg border border-border bg-white hover:bg-cream"
          >
            {t('done')} — {t('progressTitle').toLowerCase()}
          </button>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Inline status label
// ---------------------------------------------------------------------------

function StatusLabel({ status }: { status: PageStatus }) {
  const t = useTranslations('crawl')
  const map: Record<PageStatus, { label: string; className: string }> = {
    GENERATED: { label: t('statusGenerated'), className: 'text-green' },
    PENDING: { label: t('statusPending'), className: 'text-muted' },
    FAILED: { label: t('statusFailed'), className: 'text-red-500' },
    SKIPPED: { label: t('statusSkipped'), className: 'text-muted' },
  }
  const item = map[status]
  return (
    <span className={`text-xs shrink-0 ${item.className}`}>{item.label}</span>
  )
}
