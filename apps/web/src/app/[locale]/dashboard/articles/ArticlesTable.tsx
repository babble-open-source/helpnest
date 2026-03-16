'use client'

import { useState, useCallback } from 'react'
import { useRouter } from '@/i18n/navigation'
import { Link } from '@/i18n/navigation'
import { useTranslations, useFormatter, useNow } from 'next-intl'
import { ArticleActions } from './ArticleActions'

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

const STATUS_STYLES: Record<ArticleStatus, string> = {
  PUBLISHED: 'bg-green/10 text-green',
  DRAFT: 'bg-cream text-muted border border-border',
  ARCHIVED: 'bg-border/50 text-muted',
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
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <table className="w-full">
          <thead className="border-b border-border">
            <tr>
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected }}
                  onChange={toggleAll}
                  className="rounded border-border accent-ink cursor-pointer"
                  aria-label={t('selectAll')}
                />
              </th>
              <th className="text-start px-4 py-3 text-xs font-medium text-muted uppercase tracking-wide">
                {t('title')}
              </th>
              <th className="text-start px-4 py-3 text-xs font-medium text-muted uppercase tracking-wide hidden sm:table-cell">
                {t('collection')}
              </th>
              <th className="text-start px-4 py-3 text-xs font-medium text-muted uppercase tracking-wide">
                {t('status')}
              </th>
              <th className="text-end px-4 py-3 text-xs font-medium text-muted uppercase tracking-wide hidden md:table-cell">
                {t('views')}
              </th>
              <th className="text-end px-4 py-3 text-xs font-medium text-muted uppercase tracking-wide hidden lg:table-cell">
                {t('feedbackCol')}
              </th>
              <th className="text-end px-4 py-3 text-xs font-medium text-muted uppercase tracking-wide hidden lg:table-cell">
                {t('updated')}
              </th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {articles.map((article) => {
              const isChecked = selected.has(article.id)
              return (
                <tr
                  key={article.id}
                  className={`hover:bg-cream/30 transition-colors ${isChecked ? 'bg-cream/50' : ''}`}
                >
                  <td className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleOne(article.id)}
                      className="rounded border-border accent-ink cursor-pointer"
                      aria-label={`Select ${article.title}`}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/dashboard/articles/${article.id}/edit`}
                        className="font-medium text-ink text-sm truncate max-w-xs hover:text-accent transition-colors"
                      >
                        {article.title}
                      </Link>
                      {article.aiGenerated && article.status === 'DRAFT' && (
                        <span className="shrink-0 text-xs px-1.5 py-0.5 rounded bg-accent/10 text-accent font-medium">
                          {t('ai')}
                        </span>
                      )}
                      {article.aiGenerated && article.status === 'PUBLISHED' && article.draftContent && (
                        <span className="shrink-0 text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">
                          {t('aiUpdate')}
                        </span>
                      )}
                    </div>
                    {article.excerpt && (
                      <p className="text-xs text-muted mt-0.5 truncate max-w-xs">
                        {article.excerpt}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className="text-sm text-muted">{article.collection.title}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_STYLES[article.status]}`}>
                      {{ PUBLISHED: tc('published'), DRAFT: tc('draft'), ARCHIVED: tc('archived') }[article.status] ?? article.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-end hidden md:table-cell">
                    <span className="text-sm text-muted">{format.number(article.views)}</span>
                  </td>
                  <td className="px-4 py-3 text-end hidden lg:table-cell">
                    {(() => {
                      const summary = feedbackSummary(article.helpful, article.notHelpful)
                      if (summary.total === 0) {
                        return <span className="text-sm text-muted">{t('noVotes')}</span>
                      }
                      const rateTone =
                        (summary.helpfulRate ?? 0) >= 80
                          ? 'text-green'
                          : (summary.helpfulRate ?? 0) >= 60
                            ? 'text-ink'
                            : 'text-accent'
                      return (
                        <div className="space-y-0.5">
                          <p className={`text-sm font-medium ${rateTone}`}>
                            {t('percentHelpful', { rate: summary.helpfulRate ?? 0 })}
                          </p>
                          <p className="text-xs text-muted">
                            {t('votes', { count: summary.total })}
                          </p>
                        </div>
                      )
                    })()}
                  </td>
                  <td className="px-4 py-3 text-end hidden lg:table-cell">
                    <span className="text-sm text-muted">
                      {format.relativeTime(article.updatedAt, now)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <ArticleActions
                      articleId={article.id}
                      articleTitle={article.title}
                      articleStatus={article.status}
                      demoMode={demoMode}
                      isSeeded={article.isSeeded}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Bulk action toolbar */}
      {someSelected && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-ink text-cream px-4 py-3 rounded-2xl shadow-2xl shadow-ink/20 border border-white/10">
          <span className="text-sm font-medium whitespace-nowrap">
            {t('selected', { count: selected.size })}
          </span>
          <div className="w-px h-4 bg-white/20" />
          {BULK_ACTIONS.map(({ action, label, danger }) => (
            <button
              key={action}
              onClick={() => action === 'delete' ? setConfirmDelete(true) : runBulkAction(action)}
              disabled={busy}
              className={`text-sm px-3 py-1 rounded-lg transition-colors disabled:opacity-50 ${
                danger
                  ? 'hover:bg-red-500 hover:text-white text-red-400'
                  : 'hover:bg-white/10 text-cream'
              }`}
            >
              {label}
            </button>
          ))}
          <div className="w-px h-4 bg-white/20" />
          <button
            onClick={clearSelection}
            className="text-sm text-white/50 hover:text-cream transition-colors"
            aria-label="Clear selection"
          >
            ✕
          </button>
        </div>
      )}

      {/* Bulk delete confirmation modal */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40"
          onClick={() => setConfirmDelete(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h2 className="font-medium text-ink mb-2">
                {t('deleteConfirmTitle', { count: selected.size })}
              </h2>
              <p className="text-sm text-muted">
                {t('deleteConfirmMessage', { count: selected.size })}
              </p>
              {error && <p className="text-sm text-red-500 mt-3">{error}</p>}
              <div className="flex items-center justify-end gap-3 mt-6">
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-4 py-2 text-sm text-muted hover:text-ink transition-colors"
                >
                  {tc('cancel')}
                </button>
                <button
                  onClick={() => runBulkAction('delete')}
                  disabled={busy}
                  className="bg-red-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-600 transition-colors font-medium disabled:opacity-50"
                >
                  {busy ? tc('deleting') : `${tc('delete')} ${selected.size}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
