'use client'

import React, { useState } from 'react'
import { Link } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { CollectionActions } from './CollectionActions'
import { Tooltip } from '@/components/ui/Tooltip'

type GrandChild = {
  id: string
  title: string
  description: string | null
  emoji: string | null
  visibility: string
  isArchived: boolean
  _count: { articles: number; subCollections: number }
}

type SubCollection = {
  id: string
  title: string
  description: string | null
  emoji: string | null
  visibility: string
  isArchived: boolean
  _count: { articles: number; subCollections: number }
  subCollections: GrandChild[]
}

type Collection = {
  id: string
  title: string
  description: string | null
  emoji: string | null
  visibility: string
  isArchived: boolean
  _count: { articles: number; subCollections: number }
  subCollections: SubCollection[]
}

interface Props {
  collection: Collection
  demoMode: boolean
  defaultExpanded?: boolean
}

function Badges({ visibility, isArchived }: { visibility: string; isArchived: boolean }) {
  const tc = useTranslations('common')
  return (
    <>
      {visibility === 'INTERNAL' && (
        <span className="inline-flex items-center gap-1 rounded-full bg-cream border border-border px-2 py-0.5 text-[11px] font-medium text-muted shrink-0">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          {tc('internal')}
        </span>
      )}
      {isArchived && (
        <span className="rounded-full bg-border/70 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted shrink-0">
          {tc('archived')}
        </span>
      )}
    </>
  )
}

export function CollectionRow({ collection: col, demoMode, defaultExpanded = false }: Props) {
  const tc = useTranslations('common')
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [expandedSubs, setExpandedSubs] = useState<Set<string>>(new Set())
  const hasSubs = col.subCollections.length > 0

  function toggleSub(id: string) {
    setExpandedSubs((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className={`rounded-xl border ${col.isArchived ? 'bg-stone-50 border-border/80' : 'bg-white border-border'}`}>
      {/* Collection header */}
      <div className="flex items-start gap-4 p-5">
        <Link href={`/dashboard/collections/${col.id}`} className="text-2xl shrink-0 mt-0.5">
          {col.emoji ?? '📄'}
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Link href={`/dashboard/collections/${col.id}`} className="font-medium text-ink hover:text-accent transition-colors">
                  {col.title}
                </Link>
                {col._count.articles > 0 && (
                  <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent">
                    {tc('articles', { count: col._count.articles })}
                  </span>
                )}
                {hasSubs && (
                  <button
                    onClick={() => setExpanded((v) => !v)}
                    className="flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted hover:border-accent/40 hover:text-accent transition-colors"
                  >
                    {tc('subCollections', { count: col._count.subCollections })}
                    <svg
                      className={`w-3 h-3 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                )}
                <Badges visibility={col.visibility} isArchived={col.isArchived} />
              </div>
              {col.description && (
                <Tooltip content={col.description!} wrapperClassName="!block w-full">
                <p className="text-sm text-muted mt-0.5 truncate">{col.description}</p>
              </Tooltip>
              )}
            </div>
            <CollectionActions
              collection={{
                id: col.id,
                title: col.title,
                description: col.description,
                emoji: col.emoji,
                visibility: col.visibility,
                articleCount: col._count.articles,
                subCollectionCount: col._count.subCollections,
                isArchived: col.isArchived,
              }}
              demoMode={demoMode}
            />
          </div>
        </div>
      </div>

      {/* Expanded tree — individual per-row connectors, no container border */}
      {expanded && hasSubs && (
        <div className="border-t border-border px-6 py-2">
          {col.subCollections.map((sub, subIdx) => {
            const isLastSub = subIdx === col.subCollections.length - 1
            const hasGrand = sub.subCollections.length > 0

            return (
              <React.Fragment key={sub.id}>
                {/* ── Level-2 row ── */}
                {/* L2 guide x = left-3 (12px), content starts at pl-10 (40px) */}
                <div className={`relative flex items-center pl-10 pr-2 py-2 ${sub.isArchived ? 'opacity-60' : ''}`}>
                  {/* vertical top-half */}
                  <div className="absolute left-3 top-0 h-1/2 w-px bg-border/70" />
                  {/* horizontal branch */}
                  <div className="absolute left-3 top-1/2 w-5 h-px bg-border/75 -translate-y-px" />
                  {/* vertical bottom-half — only if not last, or has children */}
                  {(!isLastSub || hasGrand) && (
                    <div className="absolute left-3 top-1/2 h-1/2 w-px bg-border/70" />
                  )}

                  {/* hover only covers content, not the connector lines */}
                  <div className="flex items-center gap-2.5 min-w-0 rounded-lg hover:bg-stone-100/80 px-2 py-1 -my-1 -mx-2 transition-colors">
                    <Link href={`/dashboard/collections/${sub.id}`} className="text-base shrink-0">
                      {sub.emoji ?? '📂'}
                    </Link>
                    <div className="flex items-center gap-2 min-w-0">
                      <Tooltip content={sub.title} wrapperClassName="min-w-0 overflow-hidden">
                        <Link href={`/dashboard/collections/${sub.id}`} className="text-sm font-medium text-ink hover:text-accent transition-colors truncate block">
                          {sub.title}
                        </Link>
                      </Tooltip>
                      {sub._count.articles > 0 && (
                        <span className="shrink-0 rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent">
                          {tc('articles', { count: sub._count.articles })}
                        </span>
                      )}
                      <Badges visibility={sub.visibility} isArchived={sub.isArchived} />
                      {hasGrand && (
                        <button
                          onClick={() => toggleSub(sub.id)}
                          className="shrink-0 flex items-center justify-center w-5 h-5 rounded hover:bg-border/50 transition-colors text-muted hover:text-ink"
                          aria-label={expandedSubs.has(sub.id) ? 'Collapse' : 'Expand'}
                        >
                          <svg
                            className={`w-3 h-3 transition-transform duration-200 ${expandedSubs.has(sub.id) ? 'rotate-180' : ''}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── Level-3 rows ── */}
                {/* L3 guide x = left-9 (36px), content starts at pl-[4.5rem] */}
                {hasGrand && expandedSubs.has(sub.id) && sub.subCollections.map((grand, grandIdx) => {
                  const isLastGrand = grandIdx === sub.subCollections.length - 1

                  return (
                    <div
                      key={grand.id}
                      className={`relative flex items-center pr-2 py-1.5 ${grand.isArchived ? 'opacity-60' : ''}`}
                      style={{ paddingLeft: '4.5rem' }}
                    >
                      {/* L2 continuation — full height, only if sub is not last */}
                      {!isLastSub && <div className="absolute left-3 top-0 h-full w-px bg-border/70" />}
                      {/* L3 vertical top-half — left-12 (48px) = center of L2 emoji (starts at 40px, ~16px wide) */}
                      <div className="absolute left-12 top-0 h-1/2 w-px bg-border/60" />
                      {/* L3 horizontal branch */}
                      <div className="absolute left-12 top-1/2 w-4 h-px bg-border/70 -translate-y-px" />
                      {/* L3 vertical bottom-half — only if not last grandchild */}
                      {!isLastGrand && (
                        <div className="absolute left-12 top-1/2 h-1/2 w-px bg-border/60" />
                      )}

                      {/* hover only covers content, not the connector lines */}
                      <div className="flex items-center gap-2.5 min-w-0 rounded-lg hover:bg-stone-100/80 px-2 py-1 -my-1 -mx-2 transition-colors">
                        <Link href={`/dashboard/collections/${grand.id}`} className="text-base shrink-0">
                          {grand.emoji ?? '📂'}
                        </Link>
                        <div className="flex items-center gap-2 min-w-0">
                          <Tooltip content={grand.title} wrapperClassName="min-w-0 overflow-hidden">
                            <Link href={`/dashboard/collections/${grand.id}`} className="text-sm font-medium text-ink hover:text-accent transition-colors truncate block">
                              {grand.title}
                            </Link>
                          </Tooltip>
                          {grand._count.articles > 0 && (
                            <span className="shrink-0 rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent">
                              {tc('articles', { count: grand._count.articles })}
                            </span>
                          )}
                          <Badges visibility={grand.visibility} isArchived={grand.isArchived} />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </React.Fragment>
            )
          })}
        </div>
      )}
    </div>
  )
}
