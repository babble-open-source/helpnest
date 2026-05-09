'use client'

import { useState, useRef, useEffect } from 'react'
import { Link, useRouter } from '@/i18n/navigation'
import { useTranslations, useFormatter } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

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

const statusVariantMap: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: 'Active', className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10' },
  ESCALATED: { label: 'Escalated', className: 'bg-primary/10 text-primary hover:bg-primary/10' },
  RESOLVED_AI: { label: 'Resolved (AI)', className: 'bg-blue-100 text-blue-700 hover:bg-blue-100' },
  RESOLVED_HUMAN: { label: 'Resolved', className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10' },
  CLOSED: { label: 'Closed', className: 'bg-muted text-muted-foreground hover:bg-muted' },
}

export function ConversationDetail({
  conversation: initialConv,
  members,
  currentMemberId,
}: Props) {
  const t = useTranslations('conversation')
  const tc = useTranslations('common')
  const format = useFormatter()
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
    return format.dateTime(new Date(dateStr), {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const statusInfo = statusVariantMap[conversation.status] ?? { label: conversation.status, className: 'bg-muted text-muted-foreground' }

  return (
    <>
      {/* ── Main content column ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="border-b p-4 shrink-0">
          <div className="flex items-center gap-3">
            <Link
              href="/inbox"
              className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
              aria-label={t('backToInbox')}
            >
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-semibold text-foreground truncate">
                {conversation.subject ?? t('defaultSubject')}
              </h1>
              <p className="text-sm text-muted-foreground">
                {conversation.customerName ?? conversation.customerEmail ?? 'Anonymous'}
              </p>
            </div>
            <Badge variant="secondary" className={cn('shrink-0', statusInfo.className)}>
              {statusInfo.label}
            </Badge>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 px-4 py-3">
          <div className="space-y-2">
            {conversation.messages.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">{t('noMessages')}</p>
            )}
            {conversation.messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  'flex items-end gap-2',
                  msg.role === 'CUSTOMER' ? 'justify-end' : msg.role === 'SYSTEM' ? 'justify-center' : 'justify-start'
                )}
              >
                {/* Role avatar dot — left side for AI/AGENT */}
                {msg.role !== 'CUSTOMER' && msg.role !== 'SYSTEM' && (
                  <div className={cn(
                    'w-1.5 h-1.5 rounded-full shrink-0 mb-2',
                    msg.role === 'AI' ? 'bg-muted-foreground' : 'bg-emerald-500'
                  )} />
                )}

                <div className={cn(
                  'flex flex-col max-w-[72%]',
                  msg.role === 'CUSTOMER' ? 'items-end' : msg.role === 'SYSTEM' ? 'items-center' : 'items-start'
                )}>
                  {msg.role !== 'SYSTEM' && (
                    <p className="text-xs font-medium mb-1 text-muted-foreground">
                      {msg.role === 'CUSTOMER' ? t('customer') : msg.role === 'AI' ? t('aiAgent') : t('you')}
                    </p>
                  )}

                  <div className={cn(
                    'w-fit rounded-2xl px-3.5 py-2',
                    msg.role === 'CUSTOMER'
                      ? 'bg-primary text-primary-foreground rounded-br-sm'
                      : msg.role === 'AI'
                      ? 'bg-card border rounded-bl-sm'
                      : msg.role === 'AGENT'
                      ? 'bg-emerald-500/10 border border-emerald-500/20 rounded-bl-sm'
                      : 'bg-muted/40 text-muted-foreground italic text-xs px-3 py-1.5 rounded-full'
                  )}>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  </div>

                  <div className="flex items-center gap-2 mt-1">
                    {msg.confidence !== null && msg.role === 'AI' && (
                      <span className="text-xs text-muted-foreground">
                        {Math.round(msg.confidence * 100)}{t('confidence')}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground/60">
                      {formatTime(msg.createdAt)}
                    </span>
                  </div>
                </div>

                {/* Role avatar dot — right side for CUSTOMER */}
                {msg.role === 'CUSTOMER' && (
                  <div className="w-1.5 h-1.5 rounded-full shrink-0 mb-2 bg-foreground/40" />
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Reply composer */}
        {conversation.status !== 'CLOSED' && (
          <div className="border-t p-4 shrink-0">
            <div className="flex gap-3">
              <Textarea
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
                className="flex-1 resize-none"
              />
              <Button
                onClick={() => void handleSendReply()}
                disabled={!reply.trim() || sending}
                className="self-end bg-emerald-600 hover:bg-emerald-600/90 text-white"
              >
                {sending ? t('sending') : t('send')}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Sidebar ── */}
      <div className="w-full lg:w-72 border-t lg:border-t-0 lg:border-s p-4 space-y-6 shrink-0 overflow-y-auto">
        {/* Actions */}
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            {tc('actions')}
          </h3>
          <div className="space-y-2">
            {conversation.status === 'ESCALATED' && (
              <Button
                onClick={() => void handleAssign(currentMemberId)}
                disabled={updating}
                className="w-full bg-emerald-600 hover:bg-emerald-600/90 text-white"
              >
                {t('assignToMe')}
              </Button>
            )}
            {conversation.status !== 'RESOLVED_HUMAN' &&
              conversation.status !== 'CLOSED' && (
                <Button
                  variant="outline"
                  onClick={() => void handleStatusUpdate('RESOLVED_HUMAN')}
                  disabled={updating}
                  className="w-full border-emerald-500 text-emerald-600 hover:bg-emerald-500/5 hover:text-emerald-600 dark:text-emerald-400"
                >
                  {t('resolve')}
                </Button>
              )}
            {conversation.status !== 'CLOSED' && (
              <Button
                variant="outline"
                onClick={() => void handleStatusUpdate('CLOSED')}
                disabled={updating}
                className="w-full"
              >
                {t('closeConversation')}
              </Button>
            )}
          </div>
        </div>

        {/* Details */}
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            {t('details')}
          </h3>
          <dl className="space-y-2 text-sm">
            {conversation.customerEmail && (
              <>
                <dt className="text-muted-foreground">{t('email')}</dt>
                <dd className="text-foreground break-all">{conversation.customerEmail}</dd>
              </>
            )}
            <dt className="text-muted-foreground">{t('created')}</dt>
            <dd className="text-foreground">{formatTime(conversation.createdAt)}</dd>
            {conversation.aiConfidence !== null && (
              <>
                <dt className="text-muted-foreground">{t('aiConfidence')}</dt>
                <dd className="text-foreground">{Math.round(conversation.aiConfidence * 100)}%</dd>
              </>
            )}
            {conversation.escalationReason && (
              <>
                <dt className="text-muted-foreground">{t('escalationReason')}</dt>
                <dd className="text-foreground text-xs">{conversation.escalationReason}</dd>
              </>
            )}
            {conversation.resolutionSummary && (
              <>
                <dt className="text-muted-foreground">{t('resolutionSummary')}</dt>
                <dd className="text-foreground text-xs">{conversation.resolutionSummary}</dd>
              </>
            )}
          </dl>
        </div>

        {/* Assignment */}
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            {t('assignedTo')}
          </h3>
          <Select
            value={conversation.assignedTo?.id ?? 'unassigned'}
            onValueChange={(value) => void handleAssign(value === 'unassigned' ? null : value)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t('unassigned')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">{t('unassigned')}</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name ?? m.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Referenced articles */}
        {conversation.articles.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              {t('referencedArticles')}
            </h3>
            <div className="space-y-2">
              {conversation.articles.map((a) => (
                <div key={a.id} className="text-sm">
                  <p className="text-foreground font-medium truncate">{a.title}</p>
                  <p className="text-xs text-muted-foreground">{a.collection.title}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
