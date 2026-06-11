'use client'

import { useState, useRef, useEffect } from 'react'
import { Link, useRouter } from '@/i18n/navigation'
import { useTranslations, useFormatter } from 'next-intl'
import { Button } from '@/components/ui/button'
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
import { CustomerContextPanel } from './CustomerContextPanel'
import { MessageComposer } from './MessageComposer'
import { MessageMarkdown } from './MessageMarkdown'

interface ContactSummary {
  id: string
  fullName: string | null
  email: string | null
  phone: string | null
  avatarUrl: string | null
  primaryOrganization: {
    id: string
    name: string
    plan: string | null
  } | null
}

interface OrganizationSummary {
  id: string
  name: string
  plan: string | null
}

interface Message {
  id: string
  role: string
  content: string
  isInternal: boolean
  authorMemberId: string | null
  sources: unknown
  confidence: number | null
  feedbackHelpful: boolean | null
  createdAt: string
}

interface ConversationData {
  id: string
  number: number | null
  status: string
  customerName: string | null
  customerEmail: string | null
  subject: string | null
  aiConfidence: number | null
  escalationReason: string | null
  resolutionSummary: string | null
  contact: ContactSummary | null
  organization: OrganizationSummary | null
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
  ACTIVE: {
    label: 'Active',
    className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10',
  },
  ESCALATED: { label: 'Escalated', className: 'bg-primary/10 text-primary hover:bg-primary/10' },
  RESOLVED_AI: { label: 'Resolved (AI)', className: 'bg-blue-100 text-blue-700 hover:bg-blue-100' },
  RESOLVED_HUMAN: {
    label: 'Resolved',
    className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10',
  },
  CLOSED: { label: 'Closed', className: 'bg-muted text-muted-foreground hover:bg-muted' },
}

export function ConversationDetail({ conversation: initialConv, members, currentMemberId }: Props) {
  const t = useTranslations('conversation')
  const tc = useTranslations('common')
  const format = useFormatter()
  const [conversation, setConversation] = useState(initialConv)
  const [linkedContact, setLinkedContact] = useState(initialConv.contact)
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
          `/api/conversations/${conversation.id}/messages?since=${encodeURIComponent(since)}`
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
        assignedTo: matched ? { id: matched.id, name: matched.name, email: matched.email } : null,
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

  const statusInfo = statusVariantMap[conversation.status] ?? {
    label: conversation.status,
    className: 'bg-muted text-muted-foreground',
  }

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
              <div className="flex items-center gap-2">
                <h1 className="text-base font-semibold text-foreground truncate">
                  {conversation.subject ?? t('defaultSubject')}
                </h1>
                {conversation.number !== null && (
                  <span className="font-mono text-xs text-muted-foreground shrink-0">
                    #{conversation.number}
                  </span>
                )}
              </div>
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
            {conversation.messages.map((msg) => {
              const isInternalNote = msg.role === 'AGENT' && msg.isInternal

              return (
                <div
                  key={msg.id}
                  className={cn(
                    'flex items-end gap-2',
                    msg.role === 'CUSTOMER'
                      ? 'justify-end'
                      : msg.role === 'SYSTEM'
                        ? 'justify-center'
                        : 'justify-start'
                  )}
                >
                  {/* Role avatar dot — left side for AI/AGENT */}
                  {msg.role !== 'CUSTOMER' && msg.role !== 'SYSTEM' && (
                    <div
                      className={cn(
                        'w-1.5 h-1.5 rounded-full shrink-0 mb-2',
                        msg.role === 'AI'
                          ? 'bg-muted-foreground'
                          : isInternalNote
                            ? 'bg-amber-400'
                            : 'bg-emerald-500'
                      )}
                    />
                  )}

                  <div
                    className={cn(
                      'flex flex-col max-w-[72%]',
                      msg.role === 'CUSTOMER'
                        ? 'items-end'
                        : msg.role === 'SYSTEM'
                          ? 'items-center'
                          : 'items-start'
                    )}
                  >
                    {msg.role !== 'SYSTEM' && (
                      <div className="flex items-center gap-1.5 mb-1">
                        {isInternalNote && (
                          <span className="flex items-center gap-0.5">
                            {/* Lock icon — inline SVG for zero additional imports */}
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="w-3 h-3 text-amber-600"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                            </svg>
                          </span>
                        )}
                        <p
                          className={cn(
                            'text-xs font-medium text-muted-foreground',
                            isInternalNote && 'text-amber-800'
                          )}
                        >
                          {msg.role === 'CUSTOMER'
                            ? t('customer')
                            : msg.role === 'AI'
                              ? t('aiAgent')
                              : isInternalNote
                                ? 'Internal note'
                                : t('you')}
                        </p>
                      </div>
                    )}

                    <div
                      className={cn(
                        'w-fit rounded-2xl px-3.5 py-2',
                        msg.role === 'CUSTOMER'
                          ? 'bg-primary text-primary-foreground rounded-br-sm'
                          : msg.role === 'AI'
                            ? 'bg-card border rounded-bl-sm'
                            : isInternalNote
                              ? 'bg-amber-50 border border-amber-200 rounded-bl-sm'
                              : msg.role === 'AGENT'
                                ? 'bg-emerald-500/10 border border-emerald-500/20 rounded-bl-sm'
                                : 'bg-muted/40 text-muted-foreground italic text-xs px-3 py-1.5 rounded-full',
                        isInternalNote && 'text-amber-900'
                      )}
                    >
                      {msg.role === 'AI' || msg.role === 'AGENT' ? (
                        // AI/agent messages are authored in Markdown; customer
                        // and system messages stay verbatim plain text.
                        <MessageMarkdown content={msg.content} />
                      ) : (
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-1">
                      {msg.confidence !== null && msg.role === 'AI' && (
                        <span className="text-xs text-muted-foreground">
                          {Math.round(msg.confidence * 100)}
                          {t('confidence')}
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
              )
            })}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Composer */}
        {conversation.status !== 'CLOSED' && (
          <MessageComposer
            conversationId={conversation.id}
            onMessageSent={(msg) =>
              setConversation((prev) => ({
                ...prev,
                messages: [...prev.messages, msg],
              }))
            }
          />
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
            {conversation.status !== 'RESOLVED_HUMAN' && conversation.status !== 'CLOSED' && (
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

        {/* Customer context */}
        <CustomerContextPanel
          conversationId={conversation.id}
          contact={linkedContact}
          organization={conversation.organization}
          onContactLinked={(c) =>
            setLinkedContact({
              id: c.id,
              fullName: c.fullName,
              email: c.email,
              phone: null,
              avatarUrl: null,
              primaryOrganization: conversation.organization,
            })
          }
        />

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
