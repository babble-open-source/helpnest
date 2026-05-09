'use client'

import { useState, useCallback } from 'react'
import { useRouter } from '@/i18n/navigation'
import { Link } from '@/i18n/navigation'
import { useTranslations, useFormatter, useNow } from 'next-intl'
import { ArticleActions } from './ArticleActions'
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { X } from 'lucide-react'

type ArticleStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'

interface Article {
  id: string
  title: string
  excerpt: string | null
  status: ArticleStatus
  views: number
  helpful: number
  notHelpful: number
  updatedAt: Date
  aiGenerated: boolean
  draftContent: string | null
  isSeeded: boolean
  collection: { title: string }
}

interface Props {
  articles: Article[]
  demoMode: boolean
}

function feedbackSummary(helpful: number, notHelpful: number) {
  const total = helpful + notHelpful
  const helpfulRate = total === 0 ? null : Math.round((helpful / total) * 100)
  return { total, helpfulRate }
}

type BulkAction = 'publish' | 'archive' | 'draft' | 'delete'

export function ArticlesTable({ articles, demoMode }: Props) {
  const router = useRouter()
  const t = useTranslations('articlesTable')
  const tc = useTranslations('common')
  const format = useFormatter()
  const now = useNow()

  const BULK_ACTIONS: { action: BulkAction; label: string; danger?: boolean }[] = [
    { action: 'publish', label: tc('publish') },
    { action: 'draft', label: t('setToDraft') },
    { action: 'archive', label: tc('archive') },
    { action: 'delete', label: tc('delete'), danger: true },
  ]
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const allIds = articles.map((a) => a.id)
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id))
  const someSelected = selected.size > 0

  const toggleAll = useCallback(() => {
    setSelected(allSelected ? new Set() : new Set(allIds))
  }, [allSelected, allIds])

  const toggleOne = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const clearSelection = () => setSelected(new Set())

  async function runBulkAction(action: BulkAction) {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/articles/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selected), action }),
      })
      const data = await res.json() as { error?: string }
      if (!res.ok) {
        setError(data.error ?? tc('somethingWentWrong'))
        return
      }
      setSelected(new Set())
      setConfirmDelete(false)
      router.refresh()
    } catch {
      setError(tc('somethingWentWrong'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative">
      <div className="rounded-xl border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected}
                  ref={(el) => { if (el) (el as HTMLButtonElement & { indeterminate?: boolean }).indeterminate = someSelected && !allSelected }}
                  onCheckedChange={toggleAll}
                  aria-label={t('selectAll')}
                />
              </TableHead>
              <TableHead className="w-[25%]">{t('title')}</TableHead>
              <TableHead className="hidden sm:table-cell w-[22%]">{t('collection')}</TableHead>
              <TableHead>{t('status')}</TableHead>
              <TableHead className="text-right hidden md:table-cell">{t('views')}</TableHead>
              <TableHead className="text-right hidden lg:table-cell">{t('feedbackCol')}</TableHead>
              <TableHead className="text-right hidden lg:table-cell">{t('updated')}</TableHead>
              <TableHead className="text-right">{t('actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {articles.map((article) => {
              const isChecked = selected.has(article.id)
              return (
                <TableRow
                  key={article.id}
                  data-state={isChecked ? 'selected' : undefined}
                >
                  <TableCell>
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={() => toggleOne(article.id)}
                      aria-label={`Select ${article.title}`}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/articles/${article.id}/edit`}
                        className="font-medium text-foreground text-sm truncate max-w-xs hover:text-primary transition-colors"
                      >
                        {article.title}
                      </Link>
                      {article.aiGenerated && article.status === 'DRAFT' && (
                        <Badge variant="outline" className="shrink-0 bg-primary/10 text-primary border-transparent text-xs">
                          {t('ai')}
                        </Badge>
                      )}
                      {article.aiGenerated && article.status === 'PUBLISHED' && article.draftContent && (
                        <Badge variant="outline" className="shrink-0 bg-amber-100 text-amber-700 border-transparent text-xs">
                          {t('aiUpdate')}
                        </Badge>
                      )}
                    </div>
                    {article.excerpt && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-xs">
                        {article.excerpt}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell max-w-0">
                    <span className="text-sm text-muted-foreground truncate block">{article.collection.title}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <Badge
                        variant={article.status === 'PUBLISHED' ? 'default' : 'secondary'}
                        className={
                          article.status === 'PUBLISHED'
                            ? 'self-start bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-transparent'
                            : 'self-start'
                        }
                      >
                        {{ PUBLISHED: tc('published'), DRAFT: tc('draft'), ARCHIVED: tc('archived') }[article.status] ?? article.status}
                      </Badge>
                      {article.status === 'PUBLISHED' && article.draftContent && (
                        <span className="text-xs text-amber-600 px-2">{t('draftChanges')}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right hidden md:table-cell">
                    <span className="text-sm text-muted-foreground">{format.number(article.views)}</span>
                  </TableCell>
                  <TableCell className="text-right hidden lg:table-cell">
                    {(() => {
                      const summary = feedbackSummary(article.helpful, article.notHelpful)
                      if (summary.total === 0) {
                        return <span className="text-sm text-muted-foreground">{t('noVotes')}</span>
                      }
                      const rateTone =
                        (summary.helpfulRate ?? 0) >= 80
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : (summary.helpfulRate ?? 0) >= 60
                            ? 'text-foreground'
                            : 'text-primary'
                      return (
                        <div className="space-y-0.5">
                          <p className={`text-sm font-medium ${rateTone}`}>
                            {t('percentHelpful', { rate: summary.helpfulRate ?? 0 })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t('votes', { count: summary.total })}
                          </p>
                        </div>
                      )
                    })()}
                  </TableCell>
                  <TableCell className="text-right hidden lg:table-cell whitespace-nowrap">
                    <span className="text-sm text-muted-foreground">
                      {format.relativeTime(article.updatedAt, now)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <ArticleActions
                      articleId={article.id}
                      articleTitle={article.title}
                      articleStatus={article.status}
                      demoMode={demoMode}
                      isSeeded={article.isSeeded}
                    />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Bulk action toolbar */}
      {someSelected && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-primary text-primary-foreground px-4 py-3 rounded-2xl shadow-2xl shadow-black/20 border border-white/10">
          <span className="text-sm font-medium whitespace-nowrap">
            {t('selected', { count: selected.size })}
          </span>
          <div className="w-px h-4 bg-white/20" />
          {BULK_ACTIONS.map(({ action, label, danger }) => (
            <Button
              key={action}
              variant="ghost"
              size="sm"
              onClick={() => action === 'delete' ? setConfirmDelete(true) : runBulkAction(action)}
              disabled={busy}
              className={
                danger
                  ? 'hover:bg-destructive hover:text-destructive-foreground text-red-400 h-auto py-1'
                  : 'hover:bg-white/10 text-primary-foreground h-auto py-1'
              }
            >
              {label}
            </Button>
          ))}
          <div className="w-px h-4 bg-white/20" />
          <Button
            variant="ghost"
            size="icon"
            onClick={clearSelection}
            className="text-white/50 hover:text-primary-foreground hover:bg-white/10 h-6 w-6"
            aria-label="Clear selection"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Bulk delete confirmation */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('deleteConfirmTitle', { count: selected.size })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteConfirmMessage', { count: selected.size })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmDelete(false)}>
              {tc('cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => runBulkAction('delete')}
              disabled={busy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busy ? tc('deleting') : `${tc('delete')} ${selected.size}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
