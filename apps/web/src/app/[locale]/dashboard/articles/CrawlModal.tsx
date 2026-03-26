'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { useRouter } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'

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

export interface Collection {
  id: string
  title: string
  parentId: string | null
}

type ModalState = 'idle' | 'crawling' | 'done' | 'error'

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
  const [collectionId, setCollectionId] = useState('')
  const [result, setResult] = useState<CrawlResult | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const urlInputRef = useRef<HTMLInputElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    urlInputRef.current?.focus()
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
      setErrorMessage(t('connectionError'))
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
      aria-label={t('title')}
    >
      <div className="bg-cream border border-border rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border">
          <h2 className="font-serif text-xl text-ink">{t('title')}</h2>
          <button
            onClick={onClose}
            className="text-muted hover:text-ink transition-colors p-1 rounded-md hover:bg-border/50"
            aria-label={t('cancel')}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
          </button>
        </div>

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

  // Close on click outside
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
        {/* Display selected or show search input */}
        {selectedId && !isOpen ? (
          <button
            type="button"
            onClick={() => { setIsOpen(true); setTimeout(() => inputRef.current?.focus(), 0) }}
            className="w-full text-left text-sm bg-white border border-border rounded-lg px-3 py-2 text-ink flex items-center justify-between hover:border-ink/30 transition-colors"
          >
            <div className="min-w-0">
              <span className="block truncate">{selectedCollection?.title}</span>
              {selectedPath && selectedPath !== selectedCollection?.title && (
                <span className="block text-xs text-muted truncate">{selectedPath}</span>
              )}
            </div>
            <span
              onClick={(e) => { e.stopPropagation(); handleClear() }}
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
              onChange={(e) => { setQuery(e.target.value); setIsOpen(true) }}
              onFocus={() => setIsOpen(true)}
              placeholder={isOpen ? t('searchCollections') : t('autoOrganize')}
              className="w-full text-sm bg-white border border-border rounded-lg pl-8 pr-3 py-2 outline-none focus:border-ink text-ink placeholder:text-muted transition-colors"
              autoComplete="off"
            />
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted"
              width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"
            >
              <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
        )}

        {/* Dropdown results */}
        {isOpen && (
          <div className="absolute z-10 mt-1 w-full bg-white border border-border rounded-lg shadow-lg max-h-52 overflow-y-auto">
            {/* Auto-organize option */}
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
              <p className="px-3 py-3 text-xs text-muted text-center">
                {t('noCollectionsFound')}
              </p>
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
// Idle state
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
  const t = useTranslations('crawl')

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted leading-relaxed">{t('description')}</p>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="crawl-url" className="text-xs font-medium text-ink">
          {t('pageUrl')}
        </label>
        <input
          ref={urlInputRef}
          id="crawl-url"
          type="url"
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && url.trim() && onSubmit()}
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

      <div className="flex items-center justify-end gap-2 pt-1">
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
          disabled={!url.trim()}
          className="bg-accent text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {t('importButton')}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Crawling state
// ---------------------------------------------------------------------------

function CrawlingState() {
  const t = useTranslations('crawl')
  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <div className="w-8 h-8 border-2 border-border border-t-accent rounded-full animate-spin" aria-hidden="true" />
      <div className="text-center">
        <p className="text-sm font-medium text-ink">{t('crawling')}</p>
        <p className="text-xs text-muted mt-1">{t('crawlingHelp')}</p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Done state
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
  const t = useTranslations('crawl')

  if (result.skipped) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3 bg-white border border-border rounded-lg px-4 py-3">
          <span className="text-base mt-0.5" aria-hidden="true">&#9888;&#65039;</span>
          <div>
            <p className="text-sm font-medium text-ink">{t('pageSkipped')}</p>
            <p className="text-xs text-muted mt-0.5">
              {result.skipReason ?? t('pageSkippedDefault')}
            </p>
          </div>
        </div>
        {result.sensitiveDataWarnings && result.sensitiveDataWarnings.length > 0 && (
          <SensitiveDataWarnings warnings={result.sensitiveDataWarnings} />
        )}
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={onImportAnother} className="text-sm text-muted hover:text-ink transition-colors px-4 py-2 rounded-lg border border-border bg-white hover:bg-cream">
            {t('tryAnother')}
          </button>
          <button type="button" onClick={onClose} className="bg-ink text-cream text-sm font-medium px-4 py-2 rounded-lg hover:bg-ink/90 transition-colors">
            {t('done')}
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
          <p className="text-sm font-medium text-ink">{t('draftCreated')}</p>
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
              {t('confidence', { percent: Math.round(result.article.confidence * 100) })}
              {result.contentType && (
                <span className="ml-2 capitalize">{result.contentType.replace(/_/g, ' ')}</span>
              )}
            </p>
          )}
        </div>
      </div>
      {result.sensitiveDataWarnings && result.sensitiveDataWarnings.length > 0 && (
        <SensitiveDataWarnings warnings={result.sensitiveDataWarnings} />
      )}
      <div className="flex items-center justify-end gap-2">
        <button type="button" onClick={onImportAnother} className="text-sm text-muted hover:text-ink transition-colors px-4 py-2 rounded-lg border border-border bg-white hover:bg-cream">
          {t('importAnother')}
        </button>
        <button type="button" onClick={onClose} className="bg-ink text-cream text-sm font-medium px-4 py-2 rounded-lg hover:bg-ink/90 transition-colors">
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
        <span className="text-base mt-0.5 text-red-500" aria-hidden="true">&#x2715;</span>
        <div>
          <p className="text-sm font-medium text-ink">{t('importFailed')}</p>
          <p className="text-xs text-muted mt-0.5 break-words">{message}</p>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2">
        <button type="button" onClick={onClose} className="text-sm text-muted hover:text-ink transition-colors px-4 py-2 rounded-lg border border-border bg-white hover:bg-cream">
          {t('cancel')}
        </button>
        <button type="button" onClick={onRetry} className="bg-accent text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-accent/90 transition-colors">
          {t('tryAgain')}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sensitive data warning
// ---------------------------------------------------------------------------

function SensitiveDataWarnings({ warnings }: { warnings: string[] }) {
  const t = useTranslations('crawl')
  return (
    <div className="flex items-start gap-3 bg-white border border-amber-200 rounded-lg px-4 py-3">
      <span className="text-base mt-0.5 text-amber-500" aria-hidden="true">&#9888;</span>
      <div>
        <p className="text-xs font-medium text-ink">{t('sensitiveDataWarning')}</p>
        <ul className="mt-1 space-y-0.5">
          {warnings.map((w) => (
            <li key={w} className="text-xs text-muted">{w}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}
