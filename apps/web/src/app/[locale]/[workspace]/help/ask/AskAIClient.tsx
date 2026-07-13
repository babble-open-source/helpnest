'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
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

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: Source[]
  error?: boolean
}

interface Props {
  workspace: string
  workspaceName: string
  suggestions?: string[]
}

const MAX_QUERY_LENGTH = 500
// Matches MAX_HISTORY_MESSAGES in /api/ai-search — older turns are dropped
// server-side anyway, so don't send them.
const MAX_HISTORY_MESSAGES = 12
const SCROLL_PIN_THRESHOLD_PX = 80

let nextMessageId = 0
function createMessageId(): string {
  nextMessageId += 1
  return `msg-${nextMessageId}`
}

export function AskAIClient({ workspace, workspaceName, suggestions = [] }: Props) {
  const t = useTranslations('askAI')
  const th = useTranslations('help')
  const tc = useTranslations('common')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'streaming'>('idle')
  const [pinnedToBottom, setPinnedToBottom] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const busy = status !== 'idle'

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior })
  }, [])

  // Stick to the bottom while streaming unless the reader scrolled up.
  useEffect(() => {
    if (pinnedToBottom) scrollToBottom()
  }, [messages, pinnedToBottom, scrollToBottom])

  useEffect(() => () => abortRef.current?.abort(), [])

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    setPinnedToBottom(distanceFromBottom < SCROLL_PIN_THRESHOLD_PX)
  }

  function updateMessage(id: string, patch: Partial<ChatMessage>) {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)))
  }

  function appendMessageText(id: string, text: string) {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, content: m.content + text } : m)))
  }

  async function runRequest(question: string, priorMessages: ChatMessage[], assistantId: string) {
    const history = priorMessages
      .filter((m) => !m.error && m.content)
      .slice(-MAX_HISTORY_MESSAGES)
      .map((m) => ({ role: m.role, content: m.content }))

    const controller = new AbortController()
    abortRef.current = controller
    setStatus('loading')
    setPinnedToBottom(true)

    try {
      const res = await fetch('/api/ai-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: question, workspaceSlug: workspace, history }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        updateMessage(assistantId, { content: data.error ?? tc('somethingWentWrong'), error: true })
        setStatus('idle')
        return
      }

      const contentType = res.headers.get('content-type') ?? ''
      if (!contentType.includes('text/event-stream')) {
        const data = (await res.json()) as { answer: string; sources: Source[] }
        updateMessage(assistantId, { content: data.answer, sources: data.sources })
        setStatus('idle')
        return
      }

      setStatus('streaming')
      const reader = res.body?.getReader()
      if (!reader) {
        updateMessage(assistantId, { content: tc('somethingWentWrong'), error: true })
        setStatus('idle')
        return
      }

      const decoder = new TextDecoder()
      let buffer = ''
      let failed = false

      let streaming = true
      while (streaming) {
        const { done, value } = await reader.read()
        if (done) break

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
              | { type: 'error'; message: string }

            if (event.type === 'sources') updateMessage(assistantId, { sources: event.sources })
            else if (event.type === 'text') appendMessageText(assistantId, event.text)
            else if (event.type === 'done') streaming = false
            else if (event.type === 'error') {
              failed = true
              streaming = false
            }
          } catch {
            /* ignore malformed SSE lines */
          }
        }
      }

      if (failed) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: m.content || t('aiError'), error: true } : m
          )
        )
      }
      setStatus('idle')
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        // Stopped by the user — keep whatever streamed in as the answer. If
        // nothing arrived yet, surface it as a retryable message instead of
        // an empty bubble.
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId && !m.content ? { ...m, content: t('stopped'), error: true } : m
          )
        )
      } else {
        updateMessage(assistantId, { content: tc('networkError'), error: true })
      }
      setStatus('idle')
    } finally {
      if (abortRef.current === controller) abortRef.current = null
    }
  }

  function send(rawText: string) {
    const text = rawText.trim().slice(0, MAX_QUERY_LENGTH)
    if (!text || busy) return

    const userMessage: ChatMessage = { id: createMessageId(), role: 'user', content: text }
    const assistantMessage: ChatMessage = { id: createMessageId(), role: 'assistant', content: '' }
    const prior = messages
    setMessages([...prior, userMessage, assistantMessage])
    setInput('')
    resetTextareaHeight()
    void runRequest(text, prior, assistantMessage.id)
  }

  function handleRetry(assistantId: string) {
    const index = messages.findIndex((m) => m.id === assistantId)
    const userMessage = messages
      .slice(0, index)
      .reverse()
      .find((m) => m.role === 'user')
    if (!userMessage || busy) return
    updateMessage(assistantId, { content: '', sources: undefined, error: false })
    void runRequest(userMessage.content, messages.slice(0, index - 1), assistantId)
  }

  function handleStop() {
    abortRef.current?.abort()
  }

  function handleNewConversation() {
    abortRef.current?.abort()
    setMessages([])
    setInput('')
    setStatus('idle')
    setPinnedToBottom(true)
    textareaRef.current?.focus()
  }

  function resetTextareaHeight() {
    const el = textareaRef.current
    if (el) el.style.height = 'auto'
  }

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      send(input)
    }
  }

  const lastMessage = messages[messages.length - 1]
  const showThinking =
    status === 'loading' && lastMessage?.role === 'assistant' && !lastMessage.content

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Thread */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="relative flex-1 overflow-y-auto px-4 py-6"
      >
        {messages.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-4" aria-hidden="true">
              ✦
            </p>
            <p className="font-serif text-2xl text-ink mb-2">{t('askAnything')}</p>
            <p className="text-muted text-sm mb-8">{t('subtitle', { workspaceName })}</p>
            {suggestions.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted uppercase tracking-wide mb-3">
                  {t('tryAsking')}
                </p>
                <div className="flex flex-wrap justify-center gap-2 max-w-lg mx-auto">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => send(suggestion)}
                      className="px-3 py-1.5 rounded-full border border-border bg-white text-sm text-ink hover:border-accent hover:text-accent transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="flex justify-end mb-4">
              <button
                type="button"
                onClick={handleNewConversation}
                className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-ink transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                {t('newConversation')}
              </button>
            </div>

            <div role="log" aria-live="polite" className="space-y-5">
              {messages.map((message) =>
                message.role === 'user' ? (
                  <div key={message.id} className="flex justify-end">
                    <div className="max-w-[85%] bg-green text-white rounded-2xl rounded-ee-md px-4 py-2.5 text-sm whitespace-pre-wrap break-words">
                      {message.content}
                    </div>
                  </div>
                ) : message.id === lastMessage?.id && showThinking ? (
                  <div key={message.id} className="flex items-center gap-3 text-muted py-1">
                    <div className="flex gap-1">
                      {[0, 150, 300].map((delay) => (
                        <span
                          key={delay}
                          className="w-2 h-2 bg-green rounded-full animate-bounce motion-reduce:animate-none"
                          style={{ animationDelay: `${delay}ms` }}
                        />
                      ))}
                    </div>
                    <span className="text-sm">{t('searching')}</span>
                  </div>
                ) : (
                  <div key={message.id}>
                    {message.error ? (
                      <div className="bg-white rounded-xl border border-border p-4">
                        <p className="text-sm text-ink">{message.content}</p>
                        <button
                          type="button"
                          onClick={() => handleRetry(message.id)}
                          disabled={busy}
                          className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline disabled:opacity-50"
                        >
                          <svg
                            className="w-3.5 h-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                            />
                          </svg>
                          {t('retry')}
                        </button>
                      </div>
                    ) : (
                      <div className="bg-white rounded-xl border border-border p-4">
                        <div className="hn-prose text-sm">
                          <Markdown remarkPlugins={[remarkGfm]}>{message.content}</Markdown>
                          {status === 'streaming' && message.id === lastMessage?.id && (
                            <span className="inline-block w-0.5 h-4 bg-ink/50 ms-0.5 animate-pulse motion-reduce:animate-none align-text-bottom" />
                          )}
                        </div>
                        {message.sources &&
                          message.sources.length > 0 &&
                          !(status === 'streaming' && message.id === lastMessage?.id) && (
                            <div className="mt-3 pt-3 border-t border-border">
                              <p className="text-xs font-medium text-muted uppercase tracking-wide mb-2">
                                {t('sources')}
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {message.sources.map((source) => (
                                  <Link
                                    key={source.id}
                                    href={`/${workspace}/help/${source.collection.slug}/${source.slug}`}
                                    className="inline-flex items-center gap-1.5 max-w-full px-2.5 py-1 rounded-full border border-border bg-cream text-xs text-ink hover:border-accent hover:text-accent transition-colors"
                                  >
                                    <svg
                                      className="w-3 h-3 shrink-0"
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
                                    <span className="truncate">{source.title}</span>
                                  </Link>
                                ))}
                              </div>
                            </div>
                          )}
                      </div>
                    )}
                  </div>
                )
              )}
            </div>

            <p className="mt-6 text-xs text-muted text-center">
              {t('notWhatLooking')}{' '}
              <Link href={`/${workspace}/help`} className="text-accent hover:underline">
                {th('browseAllArticles')}
              </Link>
            </p>
          </>
        )}
      </div>

      {/* Jump to latest — shown when scrolled up during a reply */}
      {!pinnedToBottom && busy && (
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setPinnedToBottom(true)
              scrollToBottom('smooth')
            }}
            aria-label={t('scrollToLatest')}
            className="absolute -top-12 start-1/2 -translate-x-1/2 rtl:translate-x-1/2 bg-white border border-border rounded-full p-2 shadow-sm hover:border-accent hover:text-accent text-muted transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 14l-7 7m0 0l-7-7m7 7V3"
              />
            </svg>
          </button>
        </div>
      )}

      {/* Composer — pinned to bottom */}
      <div className="shrink-0 border-t border-border bg-cream px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            send(input)
          }}
        >
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={t('inputPlaceholder')}
              maxLength={MAX_QUERY_LENGTH}
              rows={1}
              className="w-full resize-none ps-4 pe-24 py-3 border border-border rounded-xl text-sm bg-white text-ink placeholder:text-muted focus:outline-none focus:border-green focus:ring-2 focus:ring-green/20"
              autoFocus
            />
            <div className="absolute end-2 bottom-2 flex items-center gap-2">
              {input.length >= MAX_QUERY_LENGTH - 100 && (
                <span className="text-xs text-muted tabular-nums">
                  {input.length}/{MAX_QUERY_LENGTH}
                </span>
              )}
              {busy ? (
                <button
                  type="button"
                  onClick={handleStop}
                  aria-label={t('stop')}
                  className="bg-ink text-white p-2 rounded-lg hover:bg-ink/80 transition-colors"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="7" y="7" width="10" height="10" rx="1.5" />
                  </svg>
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim()}
                  aria-label={t('send')}
                  className="bg-green text-white p-2 rounded-lg hover:bg-green/90 transition-colors disabled:bg-border disabled:text-muted disabled:cursor-not-allowed"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 10l7-7m0 0l7 7m-7-7v18"
                    />
                  </svg>
                </button>
              )}
            </div>
          </div>
          <p className="text-xs text-muted mt-2 text-center">{t('disclaimer')}</p>
        </form>
      </div>
    </div>
  )
}
