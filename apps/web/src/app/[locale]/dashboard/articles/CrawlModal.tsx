'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { useRouter } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { DiscoveryApproval } from './DiscoveryApproval'
import { CrawlProgress } from './CrawlProgress'
import { AiCreditsIndicator } from '@/components/AiCreditsIndicator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'

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

  useEffect(() => {
    goalInputRef.current?.focus()
    fetch('/api/crawl/credits')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: CreditsInfo | null) => { if (data) setCredits(data) })
      .catch(() => {/* credits display is non-critical */})
  }, [])

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

  // Determine modal size — progress view benefits from more width
  const isWide = state === 'progress' || state === 'discoveryApproval'

  return (
    <Dialog open onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent
        className={isWide ? 'sm:max-w-2xl max-h-[90vh] flex flex-col' : 'sm:max-w-lg max-h-[90vh] flex flex-col'}
        aria-label={t('title')}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle className="font-serif text-xl">{t('title')}</DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 py-2">
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
      </DialogContent>
    </Dialog>
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
      <label className="text-xs font-medium text-foreground">
        {t('collection')}{' '}
        <span className="text-muted-foreground font-normal">({t('collectionOptional')})</span>
      </label>
      <div ref={containerRef} className="relative">
        {selectedId && !isOpen ? (
          <button
            type="button"
            onClick={() => {
              setIsOpen(true)
              setTimeout(() => inputRef.current?.focus(), 0)
            }}
            className="w-full text-left text-sm bg-card border border-input rounded-lg px-3 py-2 text-foreground flex items-center justify-between hover:border-foreground/30 transition-colors"
          >
            <div className="min-w-0">
              <span className="block truncate">{selectedCollection?.title}</span>
              {selectedPath && selectedPath !== selectedCollection?.title && (
                <span className="block text-xs text-muted-foreground truncate">{selectedPath}</span>
              )}
            </div>
            <span
              onClick={(e) => {
                e.stopPropagation()
                handleClear()
              }}
              className="ml-2 text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
              aria-label={t('autoOrganize')}
            >
              &times;
            </span>
          </button>
        ) : (
          <div className="relative">
            <Input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setIsOpen(true)
              }}
              onFocus={() => setIsOpen(true)}
              placeholder={isOpen ? t('searchCollections') : t('autoOrganize')}
              className="pl-8"
              autoComplete="off"
            />
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground h-3.5 w-3.5" aria-hidden="true" />
          </div>
        )}

        {isOpen && (
          <div className="absolute z-10 mt-1 w-full bg-card border border-input rounded-lg shadow-lg max-h-52 overflow-y-auto">
            <button
              type="button"
              onClick={handleClear}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors ${
                !selectedId ? 'text-orange-500 font-medium' : 'text-muted-foreground'
              }`}
            >
              {t('autoOrganize')}
            </button>
            <div className="border-t" />

            {filtered.length === 0 ? (
              <p className="px-3 py-3 text-xs text-muted-foreground text-center">{t('noCollectionsFound')}</p>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleSelect(c.id)}
                  className={`w-full text-left px-3 py-2 hover:bg-muted transition-colors ${
                    c.id === selectedId ? 'bg-muted' : ''
                  }`}
                >
                  <span className="block text-sm text-foreground truncate">{c.title}</span>
                  {c.path !== c.title && (
                    <span className="block text-xs text-muted-foreground truncate">{c.path}</span>
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
      <p className="text-sm text-muted-foreground leading-relaxed">{t('description')}</p>

      {/* Goal — primary field */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="crawl-goal" className="text-xs font-medium text-foreground">
          {t('goal')}
        </label>
        <Input
          ref={goalInputRef}
          id="crawl-goal"
          type="text"
          value={goal}
          onChange={(e) => onGoalChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('goalPlaceholderModal')}
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      {/* URL — secondary field */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="crawl-url" className="text-xs font-medium text-foreground">
          {t('pageUrl')}
        </label>
        <Input
          id="crawl-url"
          type="url"
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('urlPlaceholder')}
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      <CollectionPicker
        collections={collections}
        selectedId={collectionId}
        onSelect={onCollectionChange}
      />

      <div className="bg-card border rounded-lg px-4 py-3 text-xs text-muted-foreground leading-relaxed">
        <span className="font-medium text-foreground">{t('extensionNudge')}</span>{' '}
        {t('extensionDescription')}{' '}
        <span className="text-orange-500 font-medium">{t('extensionComingSoon')}</span>
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
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancel}
          >
            {t('cancel')}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onSubmit}
            disabled={!canSubmit}
            className="bg-orange-500 text-white hover:bg-orange-500/90"
          >
            {t('importButton')}
          </Button>
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
        className="w-8 h-8 border-2 border-muted border-t-orange-500 rounded-full animate-spin"
        aria-hidden="true"
      />
      <div className="text-center">
        <p className="text-sm font-medium text-foreground">{t('analysing')}</p>
        <p className="text-xs text-muted-foreground mt-1">{t('analysingHelp')}</p>
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
        <div className="flex items-start gap-3 bg-card border rounded-lg px-4 py-3">
          <span className="text-base mt-0.5" aria-hidden="true">
            &#9888;&#65039;
          </span>
          <div>
            <p className="text-sm font-medium text-foreground">{t('noArticlesCreated')}</p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onImportAnother}>
            {t('tryAnother')}
          </Button>
          <Button type="button" size="sm" onClick={onClose}>
            {t('done')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="text-emerald-700 text-base" aria-hidden="true">
          &#10003;
        </span>
        <p className="text-sm font-medium text-foreground">
          {t('focusedComplete', { count: result.articles.length })}
        </p>
      </div>

      <div className="bg-card border rounded-lg divide-y max-h-64 overflow-y-auto">
        {result.articles.map((article) => (
          <a
            key={article.id}
            href={`/dashboard/articles/${article.id}/edit`}
            className="flex items-center justify-between px-4 py-3 hover:bg-muted transition-colors group"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm text-foreground truncate group-hover:text-orange-500 transition-colors">
                {article.title}
              </p>
              {article.excerpt && (
                <p className="text-xs text-muted-foreground truncate mt-0.5">{article.excerpt}</p>
              )}
            </div>
            <svg
              className="ml-3 shrink-0 text-muted-foreground group-hover:text-orange-500 transition-colors"
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
        <p className="text-xs text-muted-foreground">
          {t('skippedPages', { count: result.skippedPages.length })}
        </p>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onImportAnother}>
          {t('importAnotherUrl')}
        </Button>
        <Button type="button" size="sm" onClick={onClose}>
          {t('done')}
        </Button>
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
      <div className="flex items-start gap-3 bg-card border border-red-200 dark:border-red-800 rounded-lg px-4 py-3">
        <span className="text-base mt-0.5 text-destructive" aria-hidden="true">
          &#x2715;
        </span>
        <div>
          <p className="text-sm font-medium text-foreground">{t('importFailed')}</p>
          <p className="text-xs text-muted-foreground mt-0.5 break-words">{message}</p>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          {t('cancel')}
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={onRetry}
          className="bg-orange-500 text-white hover:bg-orange-500/90"
        >
          {t('tryAgain')}
        </Button>
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
    <div className="flex items-start gap-3 bg-card border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3">
      <span className="text-base mt-0.5 text-amber-500" aria-hidden="true">
        &#9888;
      </span>
      <div>
        <p className="text-xs font-medium text-foreground">{t('sensitiveDataWarning')}</p>
        <ul className="mt-1 space-y-0.5">
          {warnings.map((w) => (
            <li key={w} className="text-xs text-muted-foreground">
              {w}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
