'use client'

import { useState } from 'react'
import { Link, useRouter } from '@/i18n/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

interface KnowledgeGap {
  id: string
  query: string
  occurrences: number
  lastSeenAt: string
  resolvedAt: string | null
  resolvedBy: string | null
  resolvedArticle: { id: string; title: string } | null
  createdAt: string
}

interface Props {
  unresolved: KnowledgeGap[]
  resolved: KnowledgeGap[]
  workspaceSlug: string
}

export function KnowledgeGapsList({ unresolved, resolved, workspaceSlug }: Props) {
  const t = useTranslations('knowledgeGaps')
  const locale = useLocale()
  const [resolving, setResolving] = useState<string | null>(null)
  const router = useRouter()

  // workspaceSlug is available for future use (e.g. linking to the help center)
  void workspaceSlug

  async function handleResolve(gapId: string) {
    setResolving(gapId)
    try {
      await fetch('/api/knowledge-gaps', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: gapId }),
      })
      router.refresh()
    } finally {
      setResolving(null)
    }
  }

  function timeAgo(dateStr: string): string {
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return rtf.format(0, 'minute')
    if (mins < 60) return rtf.format(-mins, 'minute')
    const hours = Math.floor(mins / 60)
    if (hours < 24) return rtf.format(-hours, 'hour')
    const days = Math.floor(hours / 24)
    return rtf.format(-days, 'day')
  }

  return (
    <Tabs defaultValue="unresolved">
      <TabsList className="mb-4">
        <TabsTrigger value="unresolved" className="gap-2">
          {t('unresolved')}
          {unresolved.length > 0 && (
            <Badge variant="secondary" className="text-xs bg-orange-500/10 text-orange-500 hover:bg-orange-500/10">
              {unresolved.length}
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

      <TabsContent value="unresolved">
        <Card className="overflow-hidden">
          {unresolved.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-muted-foreground text-sm">{t('noGaps')}</p>
            </div>
          ) : (
            <div className="divide-y">
              {unresolved.map((gap) => (
                <div key={gap.id} className="flex items-center gap-4 p-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground text-sm">{gap.query}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-muted-foreground">
                        {t('askedTimes', { count: gap.occurrences })}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {t('lastSeen', { time: timeAgo(gap.lastSeenAt) })}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button asChild size="sm" className="bg-emerald-600 hover:bg-emerald-600/90 text-white">
                      <Link href={`/dashboard/articles/new?title=${encodeURIComponent(gap.query)}`}>
                        {t('writeArticle')}
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleResolve(gap.id)}
                      disabled={resolving === gap.id}
                    >
                      {resolving === gap.id ? t('resolving') : t('markResolved')}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </TabsContent>

      <TabsContent value="resolved">
        <Card className="overflow-hidden">
          {resolved.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-muted-foreground text-sm">{t('noResolved')}</p>
            </div>
          ) : (
            <div className="divide-y">
              {resolved.map((gap) => (
                <div key={gap.id} className="flex items-center gap-4 p-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground text-sm">{gap.query}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-muted-foreground">
                        {t('askedTimes', { count: gap.occurrences })}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {t('lastSeen', { time: timeAgo(gap.lastSeenAt) })}
                      </span>
                      {gap.resolvedArticle && (
                        <span className="text-xs text-emerald-600 dark:text-emerald-400">
                          {t('resolvedWith', { title: gap.resolvedArticle.title })}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {gap.resolvedBy && (
                      <span className="text-xs text-muted-foreground">{t('resolvedBy', { name: gap.resolvedBy })}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </TabsContent>
    </Tabs>
  )
}
