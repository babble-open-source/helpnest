'use client'

import { useRef, useEffect, useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { useSearch } from '@/hooks/useSearch'

interface Props {
  workspace: string
}

export function SearchModal({ workspace }: Props) {
  const t = useTranslations('search')
  const router = useRouter()
  const {
    isOpen,
    close,
    query,
    setQuery,
    results,
    isLoading,
    recentSearches,
    addRecentSearch,
  } = useSearch(workspace)
  const [activeIndex, setActiveIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50)
      setActiveIndex(-1)
    }
  }, [isOpen])

  useEffect(() => {
    setActiveIndex(-1)
  }, [results])

  function navigate(collectionSlug: string, articleSlug: string, q: string) {
    addRecentSearch(q)
    close()
    router.push(`/${workspace}/help/${collectionSlug}/${articleSlug}`)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const items = results.length
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, items - 1))
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, -1))
    }
    if (e.key === 'Enter' && activeIndex >= 0) {
      const r = results[activeIndex]
      if (r) navigate(r.collection.slug, r.slug, query)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) close()
      }}
    >
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={close} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden">
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <svg
            className="w-5 h-5 text-muted shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t('placeholder')}
            className="flex-1 outline-none text-ink placeholder:text-muted text-base bg-transparent"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-muted hover:text-ink text-xs"
            >
              {t('clear')}
            </button>
          )}
          <kbd className="text-xs text-muted bg-cream border border-border rounded px-1.5 py-0.5">
            {t('esc')}
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto">
          {isLoading && (
            <div className="p-4 space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse space-y-2">
                  <div className="h-4 bg-cream rounded w-3/4" />
                  <div className="h-3 bg-cream rounded w-1/2" />
                </div>
              ))}
            </div>
          )}

          {!isLoading && query.length >= 2 && results.length === 0 && (
            <div className="p-8 text-center text-muted">
              <p className="text-lg mb-1">{t('noResults', { query })}</p>
              <p className="text-sm">{t('tryDifferent')}</p>
            </div>
          )}

          {!isLoading && results.length > 0 && (
            <ul>
              {results.map((result, i) => (
                <li key={result.id}>
                  <button
                    onClick={() =>
                      navigate(result.collection.slug, result.slug, query)
                    }
                    className={`w-full text-start px-4 py-3 hover:bg-cream transition-colors ${
                      activeIndex === i ? 'bg-cream' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <svg
                        className="w-4 h-4 text-muted mt-0.5 shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-ink text-sm">{result.title}</p>
                        {result.snippet && (
                          <p className="text-xs text-muted mt-0.5 line-clamp-1">
                            {result.snippet}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs bg-cream border border-border rounded-full px-2 py-0.5 text-muted">
                            {result.collection.title}
                          </span>
                          <span className="text-xs text-muted">
                            {result.readTime} min read
                          </span>
                        </div>
                      </div>
                      <svg
                        className="w-3 h-3 text-muted mt-1 shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {!query && recentSearches.length > 0 && (
            <div className="p-4">
              <p className="text-xs font-medium text-muted uppercase tracking-wide mb-2">
                {t('recent')}
              </p>
              <ul className="space-y-1">
                {recentSearches.map((s) => (
                  <li key={s}>
                    <button
                      onClick={() => setQuery(s)}
                      className="flex items-center gap-2 w-full text-start text-sm text-ink hover:text-accent py-1 transition-colors"
                    >
                      <svg
                        className="w-3.5 h-3.5 text-muted"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!query && recentSearches.length === 0 && (
            <div className="p-6 text-center text-muted text-sm">
              {t('typeToSearch')}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-4 py-2 flex items-center gap-4 text-xs text-muted">
          <span className="flex items-center gap-1">
            <kbd className="bg-cream border border-border rounded px-1">↑↓</kbd> {t('navigateHint')}
          </span>
          <span className="flex items-center gap-1">
            <kbd className="bg-cream border border-border rounded px-1">↵</kbd> {t('openHint')}
          </span>
          <span className="flex items-center gap-1">
            <kbd className="bg-cream border border-border rounded px-1">{t('esc')}</kbd> {t('escHint')}
          </span>
        </div>
      </div>
    </div>
  )
}
