'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { useRouter } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { DiscoveryApproval } from './DiscoveryApproval'
import { CrawlProgress } from './CrawlProgress'
import { AiCreditsIndicator } from '@/components/AiCreditsIndicator'

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export interface CrawlArticle {
  id: string
  title: string
  slug: string
  collectionId: string | null
  excerpt: string
  confidence: number
}

export interface DiscoveryPage {
  url: string
  anchorText: string
  reason: string
  priority: 'high' | 'medium' | 'low'
}

interface CreditsInfo {
  used: number
  limit: number
  remaining: number
  hasOwnKey: boolean
}

interface FocusedCrawlResponse {
  crawlJobId: string
  mode: 'focused'
  articles: CrawlArticle[]
  skippedPages: Array<{ url: string; reason?: string }>
  totalPages: number
  processedPages: number
  articlesCreated: number
  credits?: { used: number; limit: number; remaining: number }
}

interface DiscoveryCrawlResponse {
  crawlJobId: string
  mode: 'discovery'
  pages: DiscoveryPage[]
  totalPages: number
  requiresVerification: boolean
}

export interface Collection {
  id: string
  title: string
  parentId: string | null
}

type ModalState =
  | 'idle'
  | 'crawling'
  | 'done'
  | 'error'
  | 'discoveryApproval'
  | 'crawlingDeep'
  | 'progress'

// Build full path for a collection (e.g., "API Reference / Authentication / OAuth")
function buildPath(collection: Collection, collectionsById: Map<string, Collection>): string {
  const parts: string[] = []
  let current: Collection | undefined = collection
  while (current) {
    parts.unshift(current.title)
    current = current.parentId ? collectionsById.get(current.parentId) : undefined
  }
  return parts.join(' / ')
}

// ---------------------------------------------------------------------------
// CrawlModal — top-level state machine
// ---------------------------------------------------------------------------

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
  const t = useTranslations('crawl')
  const [state, setState] = useState<ModalState>('idle')
  const [url, setUrl] = useState('')
  const [goal, setGoal] = useState('')
  const [collectionId, setCollectionId] = useState('')
  const [focusedResult, setFocusedResult] = useState<FocusedCrawlResponse | null>(null)
  const [discoveryResult, setDiscoveryResult] = useState<DiscoveryCrawlResponse | null>(null)
  const [activeCrawlJobId, setActiveCrawlJobId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [credits, setCredits] = useState<CreditsInfo | null>(null)
  const goalInputRef = useRef<HTMLInputElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    goalInputRef.current?.focus()
    fetch('/api/crawl/credits')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: CreditsInfo | null) => { if (data) setCredits(data) })
      .catch(() => {/* credits display is non-critical */})
  }, [])

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
    const trimmedGoal = goal.trim()
    if (!trimmedUrl || !trimmedGoal) return

    setState('crawling')
    setErrorMessage('')
    setFocusedResult(null)
    setDiscoveryResult(null)

    try {
      const res = await fetch('/api/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: trimmedUrl,
          goal: trimmedGoal,
          ...(collectionId ? { collectionId } : {}),
        }),
      })

      const data = (await res.json()) as (FocusedCrawlResponse | DiscoveryCrawlResponse) & {
        error?: string
      }

      if (!res.ok) {
        setErrorMessage((data as { error?: string }).error ?? `Request failed (HTTP ${res.status})`)
        setState('error')
        return
      }

      if (data.mode === 'focused') {
        const focused = data as FocusedCrawlResponse
        setFocusedResult(focused)
        if (focused.credits) {
          setCredits((prev) =>
            prev
              ? { ...prev, used: focused.credits!.used, limit: focused.credits!.limit, remaining: focused.credits!.remaining }
              : prev
          )
        }
        setState('done')
        onSuccess()
        router.refresh()
      } else {
        setDiscoveryResult(data as DiscoveryCrawlResponse)
        setState('discoveryApproval')
      }
    } catch {
      setErrorMessage(t('connectionError'))
      setState('error')
    }
  }

  function handleDiscoveryConfirmed(crawlJobId: string) {
    setActiveCrawlJobId(crawlJobId)
    setState('progress')
  }

  function handleProgressComplete() {
    onSuccess()
    router.refresh()
  }

  function handleReset() {
    setState('idle')
    setUrl('')
    setGoal('')
    setCollectionId('')
    setFocusedResult(null)
    setDiscoveryResult(null)
    setActiveCrawlJobId(null)
    setErrorMessage('')
    setTimeout(() => goalInputRef.current?.focus(), 0)
  }

  // Determine modal width — progress view benefits from more width
  const isWide = state === 'progress' || state === 'discoveryApproval'

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label={t('title')}
    >
      <div
        className={`bg-cream border border-border rounded-xl shadow-xl w-full ${isWide ? 'max-w-2xl' : 'max-w-lg'} max-h-[90vh] flex flex-col`}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border shrink-0">
          <h2 className="font-serif text-xl text-ink">{t('title')}</h2>
          <button
            onClick={onClose}
            className="text-muted hover:text-ink transition-colors p-1 rounded-md hover:bg-border/50"
            aria-label={t('cancel')}
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

        <div className="px-6 py-5 overflow-y-auto">
          {state === 'idle' && (
            <IdleState
              url={url}
              onUrlChange={setUrl}
              goal={goal}
              onGoalChange={setGoal}
              collectionId={collectionId}
              onCollectionChange={setCollectionId}
              collections={collections}
              onSubmit={handleCrawl}
              onCancel={onClose}
              goalInputRef={goalInputRef}
              credits={credits}
            />
          )}
          {state === 'crawling' && <CrawlingState />}
          {state === 'done' && focusedResult && (
            <FocusedDoneState
              result={focusedResult}
              onImportAnother={handleReset}
              onClose={onClose}
            />
          )}
          {state === 'error' && (
            <ErrorState message={errorMessage} onRetry={handleReset} onClose={onClose} />
          )}
          {state === 'discoveryApproval' && discoveryResult && (
            <DiscoveryApproval
              crawlJobId={discoveryResult.crawlJobId}
              pages={discoveryResult.pages}
              requiresVerification={discoveryResult.requiresVerification}
              sourceUrl={url}
              onConfirmed={handleDiscoveryConfirmed}
              onCancel={onClose}
            />
          )}
          {state === 'progress' && activeCrawlJobId && (
            <CrawlProgress
              crawlJobId={activeCrawlJobId}
              onComplete={handleProgressComplete}
              onClose={onClose}
              onImportAnother={handleReset}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Searchable Collection Picker
// ---------------------------------------------------------------------------

function CollectionPicker({
  collections,
  selectedId,
  onSelect,
}: {
  collections: Collection[]
  selectedId: string
  onSelect: (id: string) => void
}) {
  const t = useTranslations('crawl')
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const collectionsById = useMemo(() => {
    const map = new Map<string, Collection>()
    for (const c of collections) map.set(c.id, c)
    return map
  }, [collections])

  const collectionsWithPath = useMemo(() => {
    return collections.map((c) => ({
      ...c,
      path: buildPath(c, collectionsById),
    }))
  }, [collections, collectionsById])

  const filtered = useMemo(() => {
    if (!query.trim()) return collectionsWithPath
    const q = query.toLowerCase()
    return collectionsWithPath.filter(
      (c) => c.title.toLowerCase().includes(q) || c.path.toLowerCase().includes(q)
    )
  }, [query, collectionsWithPath])

  const selectedCollection = selectedId ? collectionsById.get(selectedId) : null
  const selectedPath = selectedCollection ? buildPath(selectedCollection, collectionsById) : null

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleSelect(id: string) {
    onSelect(id)
    setQuery('')
    setIsOpen(false)
  }

  function handleClear() {
    onSelect('')
    setQuery('')
    setIsOpen(false)
  }

  if (collections.length === 0) return null

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-ink">
        {t('collection')}{' '}
        <span className="text-muted font-normal">({t('collectionOptional')})</span>
      </label>
      <div ref={containerRef} className="relative">
        {selectedId && !isOpen ? (
          <button
            type="button"
            onClick={() => {
              setIsOpen(true)
              setTimeout(() => inputRef.current?.focus(), 0)
            }}
            className="w-full text-left text-sm bg-white border border-border rounded-lg px-3 py-2 text-ink flex items-center justify-between hover:border-ink/30 transition-colors"
          >
            <div className="min-w-0">
              <span className="block truncate">{selectedCollection?.title}</span>
              {selectedPath && selectedPath !== selectedCollection?.title && (
                <span className="block text-xs text-muted truncate">{selectedPath}</span>
              )}
            </div>
            <span
              onClick={(e) => {
                e.stopPropagation()
                handleClear()
              }}
              className="ml-2 text-muted hover:text-ink shrink-0 cursor-pointer"
              aria-label={t('autoOrganize')}
            >
              &times;
            </span>
          </button>
        ) : (
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setIsOpen(true)
              }}
              onFocus={() => setIsOpen(true)}
              placeholder={isOpen ? t('searchCollections') : t('autoOrganize')}
              className="w-full text-sm bg-white border border-border rounded-lg pl-8 pr-3 py-2 outline-none focus:border-ink text-ink placeholder:text-muted transition-colors"
              autoComplete="off"
            />
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted"
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
              <path
                d="M11 11l3.5 3.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
        )}

        {isOpen && (
          <div className="absolute z-10 mt-1 w-full bg-white border border-border rounded-lg shadow-lg max-h-52 overflow-y-auto">
            <button
              type="button"
              onClick={handleClear}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-cream transition-colors ${
                !selectedId ? 'text-accent font-medium' : 'text-muted'
              }`}
            >
              {t('autoOrganize')}
            </button>
            <div className="border-t border-border" />

            {filtered.length === 0 ? (
              <p className="px-3 py-3 text-xs text-muted text-center">{t('noCollectionsFound')}</p>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleSelect(c.id)}
                  className={`w-full text-left px-3 py-2 hover:bg-cream transition-colors ${
                    c.id === selectedId ? 'bg-cream' : ''
                  }`}
                >
                  <span className="block text-sm text-ink truncate">{c.title}</span>
                  {c.path !== c.title && (
                    <span className="block text-xs text-muted truncate">{c.path}</span>
                  )}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Idle state — goal (required, primary) + URL + collection picker
// ---------------------------------------------------------------------------

function IdleState({
  url,
  onUrlChange,
  goal,
  onGoalChange,
  collectionId,
  onCollectionChange,
  collections,
  onSubmit,
  onCancel,
  goalInputRef,
  credits,
}: {
  url: string
  onUrlChange: (v: string) => void
  goal: string
  onGoalChange: (v: string) => void
  collectionId: string
  onCollectionChange: (v: string) => void
  collections: Collection[]
  onSubmit: () => void
  onCancel: () => void
  goalInputRef: React.RefObject<HTMLInputElement | null>
  credits: CreditsInfo | null
}) {
  const t = useTranslations('crawl')
  const creditsExhausted = credits !== null && credits.limit !== -1 && credits.remaining === 0
  const canSubmit = goal.trim().length > 0 && url.trim().length > 0 && !creditsExhausted

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && canSubmit) onSubmit()
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted leading-relaxed">{t('description')}</p>

      {/* Goal — primary field */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="crawl-goal" className="text-xs font-medium text-ink">
          {t('goal')}
        </label>
        <input
          ref={goalInputRef}
          id="crawl-goal"
          type="text"
          value={goal}
          onChange={(e) => onGoalChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('goalPlaceholderModal')}
          className="w-full text-sm bg-white border border-border rounded-lg px-3 py-2 outline-none focus:border-ink text-ink placeholder:text-muted transition-colors"
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      {/* URL — secondary field */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="crawl-url" className="text-xs font-medium text-ink">
          {t('pageUrl')}
        </label>
        <input
          id="crawl-url"
          type="url"
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('urlPlaceholder')}
          className="w-full text-sm bg-white border border-border rounded-lg px-3 py-2 outline-none focus:border-ink text-ink placeholder:text-muted transition-colors"
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      <CollectionPicker
        collections={collections}
        selectedId={collectionId}
        onSelect={onCollectionChange}
      />

      <div className="bg-white border border-border rounded-lg px-4 py-3 text-xs text-muted leading-relaxed">
        <span className="font-medium text-ink">{t('extensionNudge')}</span>{' '}
        {t('extensionDescription')}{' '}
        <span className="text-accent font-medium">{t('extensionComingSoon')}</span>
      </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="flex-1">
          {credits !== null && (
            <AiCreditsIndicator
              used={credits.used}
              limit={credits.limit}
              remaining={credits.remaining}
            />
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onCancel}
            className="text-sm text-muted hover:text-ink transition-colors px-4 py-2 rounded-lg border border-border bg-white hover:bg-cream"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={!canSubmit}
            className="bg-accent text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t('importButton')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Crawling state (initial analysis)
// ---------------------------------------------------------------------------

function CrawlingState() {
  const t = useTranslations('crawl')
  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <div
        className="w-8 h-8 border-2 border-border border-t-accent rounded-full animate-spin"
        aria-hidden="true"
      />
      <div className="text-center">
        <p className="text-sm font-medium text-ink">{t('analysing')}</p>
        <p className="text-xs text-muted mt-1">{t('analysingHelp')}</p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Focused done state — shows articles created inline
// ---------------------------------------------------------------------------

function FocusedDoneState({
  result,
  onImportAnother,
  onClose,
}: {
  result: FocusedCrawlResponse
  onImportAnother: () => void
  onClose: () => void
}) {
  const t = useTranslations('crawl')

  if (result.articles.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3 bg-white border border-border rounded-lg px-4 py-3">
          <span className="text-base mt-0.5" aria-hidden="true">
            &#9888;&#65039;
          </span>
          <div>
            <p className="text-sm font-medium text-ink">{t('noArticlesCreated')}</p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onImportAnother}
            className="text-sm text-muted hover:text-ink transition-colors px-4 py-2 rounded-lg border border-border bg-white hover:bg-cream"
          >
            {t('tryAnother')}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="bg-ink text-cream text-sm font-medium px-4 py-2 rounded-lg hover:bg-ink/90 transition-colors"
          >
            {t('done')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="text-green-700 text-base" aria-hidden="true">
          &#10003;
        </span>
        <p className="text-sm font-medium text-ink">
          {t('focusedComplete', { count: result.articles.length })}
        </p>
      </div>

      <div className="bg-white border border-border rounded-lg divide-y divide-border max-h-64 overflow-y-auto">
        {result.articles.map((article) => (
          <a
            key={article.id}
            href={`/dashboard/articles/${article.id}/edit`}
            className="flex items-center justify-between px-4 py-3 hover:bg-cream transition-colors group"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm text-ink truncate group-hover:text-accent transition-colors">
                {article.title}
              </p>
              {article.excerpt && (
                <p className="text-xs text-muted truncate mt-0.5">{article.excerpt}</p>
              )}
            </div>
            <svg
              className="ml-3 shrink-0 text-muted group-hover:text-accent transition-colors"
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M3 8h10M9 4l4 4-4 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
        ))}
      </div>

      {result.skippedPages && result.skippedPages.length > 0 && (
        <p className="text-xs text-muted">
          {t('skippedPages', { count: result.skippedPages.length })}
        </p>
      )}

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onImportAnother}
          className="text-sm text-muted hover:text-ink transition-colors px-4 py-2 rounded-lg border border-border bg-white hover:bg-cream"
        >
          {t('importAnotherUrl')}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="bg-ink text-cream text-sm font-medium px-4 py-2 rounded-lg hover:bg-ink/90 transition-colors"
        >
          {t('done')}
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
  const t = useTranslations('crawl')
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3 bg-white border border-red-200 rounded-lg px-4 py-3">
        <span className="text-base mt-0.5 text-red-500" aria-hidden="true">
          &#x2715;
        </span>
        <div>
          <p className="text-sm font-medium text-ink">{t('importFailed')}</p>
          <p className="text-xs text-muted mt-0.5 break-words">{message}</p>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="text-sm text-muted hover:text-ink transition-colors px-4 py-2 rounded-lg border border-border bg-white hover:bg-cream"
        >
          {t('cancel')}
        </button>
        <button
          type="button"
          onClick={onRetry}
          className="bg-accent text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-accent/90 transition-colors"
        >
          {t('tryAgain')}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sensitive data warning (kept for backward compat / possible future use)
// ---------------------------------------------------------------------------

export function SensitiveDataWarnings({ warnings }: { warnings: string[] }) {
  const t = useTranslations('crawl')
  return (
    <div className="flex items-start gap-3 bg-white border border-amber-200 rounded-lg px-4 py-3">
      <span className="text-base mt-0.5 text-amber-500" aria-hidden="true">
        &#9888;
      </span>
      <div>
        <p className="text-xs font-medium text-ink">{t('sensitiveDataWarning')}</p>
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
