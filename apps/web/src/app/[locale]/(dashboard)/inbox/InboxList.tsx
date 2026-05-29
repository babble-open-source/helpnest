'use client'

import { Link } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface ConversationSummary {
  id: string
  number: number | null
  status: string
  customerName: string | null
  customerEmail: string | null
  subject: string | null
  aiConfidence: number | null
  escalationReason: string | null
  assignedTo: string | null
  firstMessage: string | null
  messageCount: number
  contact: { id: string; fullName: string | null; email: string | null } | null
  organization: { id: string; name: string; plan: string | null } | null
  createdAt: string
  updatedAt: string
}

interface Props {
  escalated: ConversationSummary[]
  active: ConversationSummary[]
  resolved: ConversationSummary[]
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function ConversationList({ conversations, activeTabKey, t }: {
  conversations: ConversationSummary[]
  activeTabKey: 'escalated' | 'active' | 'resolved'
  t: ReturnType<typeof useTranslations<'inboxPage'>>
}) {
  if (conversations.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground text-sm">
          {activeTabKey === 'escalated'
            ? t('noEscalated')
            : activeTabKey === 'active'
            ? t('noActive')
            : t('noResolved')}
        </p>
      </div>
    )
  }

  return (
    <div className="divide-y">
      {conversations.map((conv) => (
        <Link
          key={conv.id}
          href={`/inbox/${conv.id}`}
          className="flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="font-medium text-foreground truncate text-sm">
                {conv.customerName ?? conv.customerEmail ?? t('anonymous')}
              </p>
              {conv.aiConfidence !== null && (
                <Badge
                  variant="secondary"
                  className={cn(
                    'text-xs shrink-0',
                    conv.aiConfidence >= 0.7
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10'
                      : conv.aiConfidence >= 0.3
                      ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100'
                      : 'bg-primary/10 text-primary hover:bg-primary/10'
                  )}
                >
                  {Math.round(conv.aiConfidence * 100)}%
                </Badge>
              )}
            </div>
            <p className="text-sm text-foreground/80 truncate">
              {conv.subject ?? conv.firstMessage ?? t('noMessages')}
            </p>
            {conv.escalationReason && activeTabKey === 'escalated' && (
              <p className="text-xs text-primary mt-1 truncate">{conv.escalationReason}</p>
            )}
          </div>
          <div className="text-end shrink-0">
            <p className="text-xs text-muted-foreground">{timeAgo(conv.updatedAt)}</p>
            <p className="text-xs text-muted-foreground mt-1">{t('msgs', { count: conv.messageCount })}</p>
            {conv.assignedTo && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">{conv.assignedTo}</p>
            )}
          </div>
        </Link>
      ))}
    </div>
  )
}

export function InboxList({ escalated, active, resolved }: Props) {
  const t = useTranslations('inboxPage')

  return (
    <Tabs defaultValue="escalated">
      <TabsList className="mb-4">
        <TabsTrigger value="escalated" className="gap-2">
          {t('escalated')}
          {escalated.length > 0 && (
            <Badge variant="secondary" className="text-xs bg-primary/10 text-primary hover:bg-primary/10">
              {escalated.length}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="active" className="gap-2">
          {t('active')}
          {active.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {active.length}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="resolved" className="gap-2">
          {t('resolved')}
          {resolved.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {resolved.length}
            </Badge>
          )}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="escalated">
        <Card className="overflow-hidden">
          <ConversationList conversations={escalated} activeTabKey="escalated" t={t} />
        </Card>
      </TabsContent>
      <TabsContent value="active">
        <Card className="overflow-hidden">
          <ConversationList conversations={active} activeTabKey="active" t={t} />
        </Card>
      </TabsContent>
      <TabsContent value="resolved">
        <Card className="overflow-hidden">
          <ConversationList conversations={resolved} activeTabKey="resolved" t={t} />
        </Card>
      </TabsContent>
    </Tabs>
  )
}
