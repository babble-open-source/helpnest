'use client'

import { useRef, useState } from 'react'
import { Link } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Source {
  id: string
  title: string
  slug: string
  collection: { slug: string; title: string }
}

interface Props {
  workspace: string
  workspaceName: string
}

export function AskAIClient({ workspace, workspaceName }: Props) {
  const t = useTranslations('askAI')
  const th = useTranslations('help')
  const [query, setQuery] = useState('')
  const [answer, setAnswer] = useState('')
  const [sources, setSources] = useState<Source[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'streaming' | 'done' | 'error'>('idle')
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim() || status === 'loading' || status === 'streaming') return

    setAnswer('')
    setSources([])
    setStatus('loading')

    try {
      const res = await fetch('/api/ai-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, workspaceSlug: workspace }),
      })

      if (!res.ok) {
        setStatus('error')
        setAnswer('Something went wrong. Please try again.')
        return
      }

      const contentType = res.headers.get('content-type') ?? ''
      if (!contentType.includes('text/event-stream')) {
        const data = await res.json() as { answer: string; sources: Source[] }
        setAnswer(data.answer)
        setSources(data.sources)
        setStatus('done')
        return
      }

      setStatus('streaming')
      const reader = res.body?.getReader()
      if (!reader) { setStatus('error'); return }

      const decoder = new TextDecoder()
      let buffer = ''

      let streaming = true
      while (streaming) {
        const { done, value } = await reader.read()
        if (done) { streaming = false; break }

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6)) as
              | { type: 'sources'; sources: Source[] }
              | { type: 'text'; text: string }
              | { type: 'done' }

            if (event.type === 'sources') setSources(event.sources)
            else if (event.type === 'text') setAnswer((prev) => prev + event.text)
            else if (event.type === 'done') setStatus('done')
          } catch { /* ignore malformed SSE lines */ }
        }
      }
    } catch {
      setStatus('error')
      setAnswer('Failed to connect. Please check your connection and try again.')
    }
  }

  function handleReset() {
    setQuery('')
    setAnswer('')
    setSources([])
    setStatus('idle')
    inputRef.current?.focus()
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Answer area */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        {status === 'idle' && (
          <div className="text-center py-16">
            <p className="text-4xl mb-4">✦</p>
            <p className="font-serif text-2xl text-ink mb-2">{t('askAnything')}</p>
            <p className="text-muted text-sm">{t('subtitle', { workspaceName })}</p>
          </div>
        )}

        {status === 'loading' && (
          <div className="flex items-center gap-3 text-muted py-6">
            <div className="flex gap-1">
              {[0, 150, 300].map((delay) => (
                <span
                  key={delay}
                  className="w-2 h-2 bg-green rounded-full animate-bounce"
                  style={{ animationDelay: `${delay}ms` }}
                />
              ))}
            </div>
            <span className="text-sm">{t('searching')}</span>
          </div>
        )}

        {(status === 'streaming' || status === 'done' || status === 'error') && answer && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-4 h-4 text-green shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <p className="text-xs font-medium text-muted uppercase tracking-wide">{t('answer')}</p>
            </div>
            <div className="bg-white rounded-xl border border-border p-4">
              <div className="hn-prose text-sm">
                <Markdown remarkPlugins={[remarkGfm]}>{answer}</Markdown>
                {status === 'streaming' && (
                  <span className="inline-block w-0.5 h-4 bg-ink/50 ms-0.5 animate-pulse align-text-bottom" />
                )}
              </div>
            </div>
          </div>
        )}

        {sources.length > 0 && status !== 'streaming' && (
          <div>
            <p className="text-xs font-medium text-muted uppercase tracking-wide mb-3">{t('sources')}</p>
            <div className="space-y-2">
              {sources.map((source) => (
                <Link
                  key={source.id}
                  href={`/${workspace}/help/${source.collection.slug}/${source.slug}`}
                  className="flex items-center gap-3 p-3 rounded-xl border border-border bg-white hover:border-accent transition-colors group"
                >
                  <svg className="w-4 h-4 text-muted group-hover:text-accent shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink group-hover:text-accent truncate">{source.title}</p>
                    <p className="text-xs text-muted">{source.collection.title}</p>
                  </div>
                  <svg className="w-4 h-4 text-muted group-hover:text-accent shrink-0 ms-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>
            <p className="mt-5 text-xs text-muted text-center">
              {t('notWhatLooking')}{' '}
              <Link href={`/${workspace}/help`} className="text-accent hover:underline">
                {th('browseAllArticles')}
              </Link>
            </p>
          </div>
        )}

        {status === 'done' && (
          <div className="mt-6 text-center">
            <button
              onClick={handleReset}
              className="text-sm text-muted hover:text-ink transition-colors underline underline-offset-2"
            >
              {t('askAnother')}
            </button>
          </div>
        )}
      </div>

      {/* Input bar — pinned to bottom */}
      <div className="shrink-0 border-t border-border bg-cream px-4 py-4">
        <form onSubmit={handleSubmit}>
          <div className="relative">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('inputPlaceholder')}
              disabled={status === 'loading' || status === 'streaming'}
              className="w-full ps-4 pe-12 py-3 border border-border rounded-xl text-sm bg-white text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-green disabled:opacity-50"
              autoFocus
            />
            <button
              type="submit"
              disabled={!query.trim() || status === 'loading' || status === 'streaming'}
              aria-label="Ask"
              className="absolute end-2 top-1/2 -translate-y-1/2 bg-green text-white p-2 rounded-lg hover:bg-green/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
          </div>
          <p className="text-xs text-muted mt-2 text-center">
            {t('disclaimer')}
          </p>
        </form>
      </div>
    </div>
  )
}
