'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'

interface Source {
  id: string
  title: string
  slug: string
  collection: { slug: string; title: string }
}

interface Props {
  workspace: string
  workspaceName: string
  onClose: () => void
}

export function AskAIModal({ workspace, workspaceName, onClose }: Props) {
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
          } catch (_e) { /* ignore malformed SSE lines */ }
        }
      }
    } catch {
      setStatus('error')
      setAnswer('Failed to connect. Please check your connection and try again.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg overflow-hidden flex flex-col max-h-[90vh] sm:max-h-[80vh]">
        {/* Mobile drag handle */}
        <div className="sm:hidden flex justify-center pt-3 pb-0 shrink-0">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-green text-white">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="font-medium text-sm">Ask AI — {workspaceName}</span>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {status === 'idle' && (
            <div className="text-center py-5 sm:py-8">
              <p className="text-3xl mb-3">✦</p>
              <p className="font-medium text-ink mb-1">Ask anything</p>
              <p className="text-sm text-muted">Get instant answers from the {workspaceName} help center</p>
            </div>
          )}

          {status === 'loading' && (
            <div className="flex items-center gap-3 text-muted py-4">
              <div className="flex gap-1">
                {[0, 150, 300].map((delay) => (
                  <span
                    key={delay}
                    className="w-2 h-2 bg-green rounded-full animate-bounce"
                    style={{ animationDelay: `${delay}ms` }}
                  />
                ))}
              </div>
              <span className="text-sm">Searching help center...</span>
            </div>
          )}

          {(status === 'streaming' || status === 'done' || status === 'error') && answer && (
            <div className="mb-4">
              <p className="text-xs font-medium text-muted uppercase tracking-wide mb-2">Answer</p>
              <div className="text-ink text-sm leading-relaxed whitespace-pre-wrap">
                {answer}
                {status === 'streaming' && (
                  <span className="inline-block w-0.5 h-4 bg-ink/50 ml-0.5 animate-pulse align-text-bottom" />
                )}
              </div>
            </div>
          )}

          {sources.length > 0 && status !== 'streaming' && (
            <div>
              <p className="text-xs font-medium text-muted uppercase tracking-wide mb-2">Sources</p>
              <div className="space-y-2">
                {sources.map((source) => (
                  <Link
                    key={source.id}
                    href={`/${workspace}/help/${source.collection.slug}/${source.slug}`}
                    onClick={onClose}
                    className="flex items-center gap-2 p-3 rounded-lg border border-border hover:border-accent transition-colors group"
                  >
                    <svg className="w-4 h-4 text-muted group-hover:text-accent shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink group-hover:text-accent truncate">{source.title}</p>
                      <p className="text-xs text-muted">{source.collection.title}</p>
                    </div>
                  </Link>
                ))}
              </div>
              <p className="mt-4 text-xs text-muted text-center">
                Not what you were looking for?{' '}
                <Link href={`/${workspace}/help`} onClick={onClose} className="text-accent hover:underline">
                  Browse all articles
                </Link>
              </p>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="border-t border-border p-4">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask a question..."
              disabled={status === 'loading' || status === 'streaming'}
              className="flex-1 px-3 py-2 border border-border rounded-lg text-sm bg-white text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-green disabled:opacity-50"
              autoFocus
            />
            <button
              type="submit"
              disabled={!query.trim() || status === 'loading' || status === 'streaming'}
              className="bg-green text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Ask
            </button>
          </div>
          <p className="text-xs text-muted mt-2 text-center">
            AI answers are based on our help center articles
          </p>
        </form>
      </div>
    </div>
  )
}
