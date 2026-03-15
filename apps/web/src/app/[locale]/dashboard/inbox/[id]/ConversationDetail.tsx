'use client'

import { useState, useRef, useEffect } from 'react'
import { Link, useRouter } from '@/i18n/navigation'
import { useTranslations, useLocale } from 'next-intl'

interface Message {
  id: string
  role: string
  content: string
  sources: unknown
  confidence: number | null
  feedbackHelpful: boolean | null
  createdAt: string
}

interface ConversationData {
  id: string
  status: string
  customerName: string | null
  customerEmail: string | null
  subject: string | null
  aiConfidence: number | null
  escalationReason: string | null
  resolutionSummary: string | null
  assignedTo: { id: string; name: string | null; email: string } | null
  articles: Array<{
    id: string
    title: string
    slug: string
    collection: { slug: string; title: string }
  }>
  messages: Message[]
  createdAt: string
  updatedAt: string
}

interface MemberOption {
  id: string
  name: string | null
  email: string
}

interface Props {
  conversation: ConversationData
  members: MemberOption[]
  currentMemberId: string
}

const statusColors: Record<string, string> = {
  ACTIVE: 'bg-green/10 text-green',
  ESCALATED: 'bg-accent/10 text-accent',
  RESOLVED_AI: 'bg-blue-100 text-blue-700',
  RESOLVED_HUMAN: 'bg-green/10 text-green',
  CLOSED: 'bg-border text-muted',
}

export function ConversationDetail({
  conversation: initialConv,
  members,
  currentMemberId,
}: Props) {
  const t = useTranslations('conversation')
  const tc = useTranslations('common')
  const locale = useLocale()
  const [conversation, setConversation] = useState(initialConv)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [updating, setUpdating] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  // Scroll to bottom whenever messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversation.messages.length])

  // Poll for new messages every 10 seconds while the tab is focused
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const lastMsg = conversation.messages[conversation.messages.length - 1]
        const since = lastMsg?.createdAt ?? conversation.createdAt
        const res = await fetch(
          `/api/conversations/${conversation.id}/messages?since=${encodeURIComponent(since)}`,
        )
        if (!res.ok) return
        const data = (await res.json()) as { messages?: Message[] }
        if (data.messages && data.messages.length > 0) {
          setConversation((prev) => ({
            ...prev,
            messages: [
              ...prev.messages,
              ...data.messages!.map((m) => ({
                ...m,
                createdAt:
                  typeof m.createdAt === 'string'
                    ? m.createdAt
                    : new Date(m.createdAt).toISOString(),
              })),
            ],
          }))
        }
      } catch {
        // Swallow polling errors silently — network hiccups shouldn't surface to the UI
      }
    }, 10_000)
    return () => clearInterval(interval)
  }, [conversation.id, conversation.messages, conversation.createdAt])

  async function handleSendReply() {
    if (!reply.trim() || sending) return
    setSending(true)
    try {
      const res = await fetch(`/api/conversations/${conversation.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: reply.trim() }),
      })
      if (res.ok) {
        const data = (await res.json()) as { message: Message }
        setConversation((prev) => ({
          ...prev,
          messages: [
            ...prev.messages,
            {
              ...data.message,
              createdAt:
                typeof data.message.createdAt === 'string'
                  ? data.message.createdAt
                  : new Date(data.message.createdAt).toISOString(),
            },
          ],
        }))
        setReply('')
      }
    } finally {
      setSending(false)
    }
  }

  async function handleStatusUpdate(status: string) {
    setUpdating(true)
    try {
      const res = await fetch(`/api/conversations/${conversation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (res.ok) {
        setConversation((prev) => ({ ...prev, status }))
        router.refresh()
      }
    } finally {
      setUpdating(false)
    }
  }

  async function handleAssign(memberId: string | null) {
    try {
      await fetch(`/api/conversations/${conversation.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId }),
      })
      const matched = memberId ? members.find((m) => m.id === memberId) : null
      setConversation((prev) => ({
        ...prev,
        assignedTo: matched
          ? { id: matched.id, name: matched.name, email: matched.email }
          : null,
      }))
    } catch {
      // Silently ignore assignment errors — UI stays optimistic, next refresh will correct
    }
  }

  function formatTime(dateStr: string): string {
    return new Date(dateStr).toLocaleString(locale, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <>
      {/* ── Main content column ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="border-b border-border p-4 shrink-0">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/inbox"
              className="text-muted hover:text-ink transition-colors shrink-0"
              aria-label={t('backToInbox')}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </Link>
            <div className="flex-1 min-w-0">
              <h1 className="font-serif text-xl text-ink truncate">
                {conversation.subject ?? t('defaultSubject')}
              </h1>
              <p className="text-sm text-muted">
                {conversation.customerName ?? conversation.customerEmail ?? 'Anonymous'}
              </p>
            </div>
            <span
              className={`text-xs px-2 py-1 rounded-full font-medium shrink-0 ${
                statusColors[conversation.status] ?? 'bg-border text-muted'
              }`}
            >
              {conversation.status.replace('_', ' ')}
            </span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {conversation.messages.length === 0 && (
            <p className="text-sm text-muted text-center py-8">{t('noMessages')}</p>
          )}
          {conversation.messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-end gap-2 ${
                msg.role === 'CUSTOMER'
                  ? 'justify-end'
                  : msg.role === 'SYSTEM'
                  ? 'justify-center'
                  : 'justify-start'
              }`}
            >
              {/* Role avatar dot — left side for AI/AGENT */}
              {msg.role !== 'CUSTOMER' && msg.role !== 'SYSTEM' && (
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 mb-2 ${
                  msg.role === 'AI' ? 'bg-muted' : 'bg-green'
                }`} />
              )}

              <div className={`flex flex-col max-w-[72%] ${
                msg.role === 'CUSTOMER' ? 'items-end' : msg.role === 'SYSTEM' ? 'items-center' : 'items-start'
              }`}>
                {msg.role !== 'SYSTEM' && (
                  <p className="text-xs font-medium mb-1 text-muted">
                    {msg.role === 'CUSTOMER' ? t('customer') : msg.role === 'AI' ? t('aiAgent') : t('you')}
                  </p>
                )}

                <div className={`w-fit rounded-2xl px-3.5 py-2 ${
                  msg.role === 'CUSTOMER'
                    ? 'bg-ink text-cream rounded-br-sm'
                    : msg.role === 'AI'
                    ? 'bg-white border border-border rounded-bl-sm'
                    : msg.role === 'AGENT'
                    ? 'bg-green/10 border border-green/20 rounded-bl-sm'
                    : 'bg-border/40 text-muted italic text-xs px-3 py-1.5 rounded-full'
                }`}>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                </div>

                <div className="flex items-center gap-2 mt-1">
                  {msg.confidence !== null && msg.role === 'AI' && (
                    <span className="text-xs text-muted">
                      {Math.round(msg.confidence * 100)}{t('confidence')}
                    </span>
                  )}
                  <span className="text-xs text-muted/60">
                    {formatTime(msg.createdAt)}
                  </span>
                </div>
              </div>

              {/* Role avatar dot — right side for CUSTOMER */}
              {msg.role === 'CUSTOMER' && (
                <div className="w-1.5 h-1.5 rounded-full shrink-0 mb-2 bg-ink/40" />
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Reply composer */}
        {conversation.status !== 'CLOSED' && (
          <div className="border-t border-border p-4 shrink-0">
            <div className="flex gap-3">
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void handleSendReply()
                  }
                }}
                placeholder={t('replyPlaceholder')}
                rows={2}
                className="flex-1 px-3 py-2 border border-border rounded-lg text-sm resize-none focus:outline-none focus:border-green focus:ring-1 focus:ring-green/20"
              />
              <button
                onClick={() => void handleSendReply()}
                disabled={!reply.trim() || sending}
                className="px-4 py-2 bg-green text-white rounded-lg text-sm font-medium hover:bg-green/90 disabled:opacity-50 disabled:cursor-not-allowed shrink-0 self-end"
              >
                {sending ? t('sending') : t('send')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Sidebar ── */}
      <div className="w-full lg:w-72 border-t lg:border-t-0 lg:border-l border-border p-4 space-y-6 shrink-0 overflow-y-auto">
        {/* Actions */}
        <div>
          <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
            {tc('actions')}
          </h3>
          <div className="space-y-2">
            {conversation.status === 'ESCALATED' && (
              <button
                onClick={() => void handleAssign(currentMemberId)}
                disabled={updating}
                className="w-full px-3 py-2 text-sm font-medium bg-green text-white rounded-lg hover:bg-green/90 disabled:opacity-50 transition-colors"
              >
                {t('assignToMe')}
              </button>
            )}
            {conversation.status !== 'RESOLVED_HUMAN' &&
              conversation.status !== 'CLOSED' && (
                <button
                  onClick={() => void handleStatusUpdate('RESOLVED_HUMAN')}
                  disabled={updating}
                  className="w-full px-3 py-2 text-sm font-medium border border-green text-green rounded-lg hover:bg-green/5 disabled:opacity-50 transition-colors"
                >
                  {t('resolve')}
                </button>
              )}
            {conversation.status !== 'CLOSED' && (
              <button
                onClick={() => void handleStatusUpdate('CLOSED')}
                disabled={updating}
                className="w-full px-3 py-2 text-sm font-medium border border-border text-muted rounded-lg hover:bg-border/30 disabled:opacity-50 transition-colors"
              >
                {t('closeConversation')}
              </button>
            )}
          </div>
        </div>

        {/* Details */}
        <div>
          <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
            {t('details')}
          </h3>
          <dl className="space-y-2 text-sm">
            {conversation.customerEmail && (
              <>
                <dt className="text-muted">{t('email')}</dt>
                <dd className="text-ink break-all">{conversation.customerEmail}</dd>
              </>
            )}
            <dt className="text-muted">{t('created')}</dt>
            <dd className="text-ink">{formatTime(conversation.createdAt)}</dd>
            {conversation.aiConfidence !== null && (
              <>
                <dt className="text-muted">{t('aiConfidence')}</dt>
                <dd className="text-ink">{Math.round(conversation.aiConfidence * 100)}%</dd>
              </>
            )}
            {conversation.escalationReason && (
              <>
                <dt className="text-muted">{t('escalationReason')}</dt>
                <dd className="text-ink text-xs">{conversation.escalationReason}</dd>
              </>
            )}
            {conversation.resolutionSummary && (
              <>
                <dt className="text-muted">{t('resolutionSummary')}</dt>
                <dd className="text-ink text-xs">{conversation.resolutionSummary}</dd>
              </>
            )}
          </dl>
        </div>

        {/* Assignment */}
        <div>
          <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
            {t('assignedTo')}
          </h3>
          <div className="relative">
            <select
              value={conversation.assignedTo?.id ?? ''}
              onChange={(e) => void handleAssign(e.target.value || null)}
              className="w-full appearance-none px-2 py-1.5 pr-7 text-sm border border-border rounded-lg bg-white focus:outline-none focus:border-green transition-colors cursor-pointer"
            >
              <option value="">{t('unassigned')}</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name ?? m.email}
                </option>
              ))}
            </select>
            <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {/* Referenced articles */}
        {conversation.articles.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
              {t('referencedArticles')}
            </h3>
            <div className="space-y-2">
              {conversation.articles.map((a) => (
                <div key={a.id} className="text-sm">
                  <p className="text-ink font-medium truncate">{a.title}</p>
                  <p className="text-xs text-muted">{a.collection.title}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
