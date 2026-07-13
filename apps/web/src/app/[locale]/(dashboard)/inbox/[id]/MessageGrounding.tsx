'use client'

/**
 * MessageGrounding — shows a human agent WHAT the AI answered from.
 *
 * The AI already recorded its sources and its grounding breakdown; until now the
 * inbox rendered only a bare confidence percentage, so the one person best placed
 * to notice "that article is six months out of date" could not see which article
 * the answer came from.
 *
 * That matters because of a failure mode the escalation gate cannot catch by
 * design: retrieval similarity measures whether an article is ABOUT the question,
 * not whether it is CORRECT or CURRENT. A stale-but-on-topic article scores high
 * and sails straight through the gate. Nothing automated will flag it. A human
 * looking at the source link will.
 */

import { Link } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { AlertTriangle, FileText } from 'lucide-react'

export interface MessageSource {
  id: string
  title: string
  slug: string
  collection?: { slug: string; title: string }
}

export interface MessageGroundingProps {
  sources: unknown
  confidence: number | null
  retrievalMode: string | null
  retrievalScore: number | null
  reportedConfidence: number | null
  retrievalDegraded: boolean | null
}

/**
 * `sources` arrives as a Prisma Json column, so it is genuinely `unknown` at the
 * type level and may be null, a stray object, or legacy data. Parse defensively —
 * a malformed row must not blank the whole conversation view.
 */
function parseSources(raw: unknown): MessageSource[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (entry): entry is MessageSource =>
      typeof entry === 'object' &&
      entry !== null &&
      typeof (entry as MessageSource).id === 'string' &&
      typeof (entry as MessageSource).title === 'string'
  )
}

export function MessageGrounding({
  sources,
  confidence,
  retrievalMode,
  retrievalScore,
  reportedConfidence,
  retrievalDegraded,
}: MessageGroundingProps) {
  const t = useTranslations('conversation')
  const parsed = parseSources(sources)

  // A turn where the agent never searched (a greeting) has null confidence and no
  // sources. There is nothing to show and nothing to second-guess.
  const hasGrounding = confidence !== null || parsed.length > 0
  if (!hasGrounding) return null

  const percent = (value: number) => `${Math.round(value * 100)}%`

  return (
    <div className="mt-1.5 space-y-1.5">
      {retrievalDegraded && (
        <div className="flex items-start gap-1.5 text-xs text-amber-700">
          <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" aria-hidden="true" />
          <span>{t('groundingDegraded')}</span>
        </div>
      )}

      {parsed.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground/70">{t('answeredFrom')}</span>
          {parsed.map((source) => (
            <Link
              key={source.id}
              href={`/articles/${source.id}/edit`}
              className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2 py-0.5 text-xs text-foreground/80 hover:bg-muted hover:text-foreground transition-colors"
            >
              <FileText className="w-3 h-3 shrink-0" aria-hidden="true" />
              {source.title}
            </Link>
          ))}
        </div>
      )}

      {/*
        The breakdown, spelled out rather than reduced to one number: a single
        confidence score cannot tell you whether a low value came from weak
        retrieval or from the model doubting itself, and those call for opposite
        fixes — write the missing article, versus look at the prompt.
      */}
      {confidence !== null && retrievalMode && retrievalMode !== 'none' && (
        <p className="text-xs text-muted-foreground/70">
          {retrievalMode === 'vector'
            ? t('groundingVector', {
                score: retrievalScore === null ? '—' : percent(retrievalScore),
              })
            : t('groundingLexical', {
                score: retrievalScore === null ? '—' : percent(retrievalScore),
              })}
          {reportedConfidence !== null &&
            ` · ${t('selfReported', { score: percent(reportedConfidence) })}`}
        </p>
      )}

      {confidence !== null && retrievalMode === 'none' && (
        <p className="text-xs text-muted-foreground/70">{t('groundingNone')}</p>
      )}
    </div>
  )
}
