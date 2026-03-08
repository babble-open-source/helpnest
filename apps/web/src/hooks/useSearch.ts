'use client'

import { useState, useEffect, useCallback } from 'react'

export interface SearchResult {
  id: string
  title: string
  slug: string
  snippet: string
  collection: { title: string; slug: string }
  readTime: number
}

export function useSearch(workspace: string) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [recentSearches, setRecentSearches] = useState<string[]>([])

  useEffect(() => {
    try {
      const stored = localStorage.getItem('helpnest_recent_searches')
      if (stored) setRecentSearches(JSON.parse(stored) as string[])
    } catch (_e) { /* localStorage unavailable */ }
  }, [])

  // Keyboard shortcut + custom event listener
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen((o) => !o)
      }
      if (e.key === 'Escape') setIsOpen(false)
    }
    function onOpen() {
      setIsOpen(true)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('helpnest:search:open', onOpen)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('helpnest:search:open', onOpen)
    }
  }, [])

  // Debounced search
  useEffect(() => {
    if (query.length < 2) {
      setResults([])
      return
    }
    const timer = setTimeout(async () => {
      setIsLoading(true)
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(query)}&workspace=${workspace}`
        )
        const data = (await res.json()) as { results: SearchResult[] }
        setResults(data.results)
      } catch {
        setResults([])
      } finally {
        setIsLoading(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [query, workspace])

  const addRecentSearch = useCallback(
    (q: string) => {
      const updated = [q, ...recentSearches.filter((s) => s !== q)].slice(0, 5)
      setRecentSearches(updated)
      try {
        localStorage.setItem('helpnest_recent_searches', JSON.stringify(updated))
      } catch (_e) { /* localStorage unavailable */ }
    },
    [recentSearches]
  )

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => {
    setIsOpen(false)
    setQuery('')
    setResults([])
  }, [])

  return {
    isOpen,
    open,
    close,
    query,
    setQuery,
    results,
    isLoading,
    recentSearches,
    addRecentSearch,
  }
}
