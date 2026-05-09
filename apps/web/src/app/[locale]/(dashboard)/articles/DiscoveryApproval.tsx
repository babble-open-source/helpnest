'use client'

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import type { DiscoveryPage } from './CrawlModal'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DomainVerifyResponse {
  verified: boolean
  domain?: string
  token?: string
  instructions?: string
  error?: string
}

interface ConfirmResponse {
  crawlJobId: string
  totalPages: number
  status: string
  error?: string
}

// ---------------------------------------------------------------------------
// Priority badge
// ---------------------------------------------------------------------------

function PriorityBadge({ priority }: { priority: string }) {
  const t = useTranslations('crawl')
  const label =
    priority === 'high'
      ? t('priorityHigh')
      : priority === 'medium'
        ? t('priorityMedium')
        : t('priorityLow')

  const className =
    priority === 'high'
      ? 'bg-primary/10 text-primary border-transparent'
      : priority === 'medium'
        ? 'bg-amber-100 text-amber-700 border-transparent'
        : 'bg-secondary text-secondary-foreground border-transparent'

  return (
    <Badge variant="outline" className={cn('text-xs capitalize shrink-0', className)}>
      {label}
    </Badge>
  )
}

// ---------------------------------------------------------------------------
// Domain Verification panel
// ---------------------------------------------------------------------------

function DomainVerification({
  domain,
  onVerified,
}: {
  domain: string
  onVerified: () => void
}) {
  const t = useTranslations('crawl')
  const [step, setStep] = useState<'idle' | 'initiated' | 'checking' | 'verified' | 'failed'>(
    'idle'
  )
  const [token, setToken] = useState<string | null>(null)
  const [instructions, setInstructions] = useState<string | null>(null)
  const [checkError, setCheckError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function initiateVerification() {
    setStep('initiated')
    setCheckError(null)
    try {
      const res = await fetch('/api/domain/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'initiate', domain }),
      })
      const data = (await res.json()) as DomainVerifyResponse
      if (data.verified) {
        setStep('verified')
        onVerified()
        return
      }
      if (data.token) setToken(data.token)
      if (data.instructions) setInstructions(data.instructions)
    } catch {
      setCheckError('Failed to contact server. Please try again.')
      setStep('idle')
    }
  }

  async function checkVerification() {
    setStep('checking')
    setCheckError(null)
    try {
      const res = await fetch('/api/domain/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check', domain }),
      })
      const data = (await res.json()) as DomainVerifyResponse
      if (data.verified) {
        setStep('verified')
        onVerified()
      } else {
        setCheckError(data.error ?? t('verifyDomainFailed'))
        setStep('initiated')
      }
    } catch {
      setCheckError('Failed to contact server. Please try again.')
      setStep('initiated')
    }
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  const metaTag = token ? `<meta name="helpnest-verify" content="${token}">` : null

  if (step === 'verified') {
    return (
      <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-200 dark:border-emerald-800 rounded-lg px-4 py-3">
        <svg
          className="text-emerald-600 dark:text-emerald-400 shrink-0"
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M3 8l3.5 3.5L13 4"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">{t('verifyDomainSuccess')}</p>
      </div>
    )
  }

  if (step === 'idle') {
    return (
      <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3 flex flex-col gap-2">
        <p className="text-sm font-medium text-foreground">{t('verifyDomainHeading')}</p>
        <p className="text-xs text-muted-foreground">{t('verifyDomainDescription', { domain })}</p>
        <Button
          type="button"
          variant="link"
          size="sm"
          onClick={initiateVerification}
          className="self-start h-auto p-0 text-primary"
        >
          Get verification code
        </Button>
      </div>
    )
  }

  return (
    <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3 flex flex-col gap-3">
      <p className="text-sm font-medium text-foreground">{t('verifyDomainHeading')}</p>
      {instructions && <p className="text-xs text-muted-foreground">{instructions}</p>}
      {metaTag && (
        <div className="flex items-stretch gap-2">
          <code className="flex-1 text-xs bg-card border rounded px-3 py-2 font-mono text-foreground break-all">
            {metaTag}
          </code>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => copyToClipboard(metaTag)}
            className="shrink-0"
          >
            {copied ? t('verifyDomainCopied') : t('verifyDomainCopy')}
          </Button>
        </div>
      )}
      {checkError && <p className="text-xs text-destructive">{checkError}</p>}
      <Button
        type="button"
        size="sm"
        onClick={checkVerification}
        disabled={step === 'checking'}
        className="self-start"
      >
        {step === 'checking' ? t('verifyDomainChecking') : t('verifyDomainCheck')}
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// DiscoveryApproval
// ---------------------------------------------------------------------------

export function DiscoveryApproval({
  crawlJobId,
  pages,
  requiresVerification,
  sourceUrl,
  onConfirmed,
  onCancel,
}: {
  crawlJobId: string
  pages: DiscoveryPage[]
  requiresVerification: boolean
  sourceUrl: string
  onConfirmed: (crawlJobId: string) => void
  onCancel: () => void
}) {
  const t = useTranslations('crawl')

  const [checked, setChecked] = useState<Set<string>>(() => new Set(pages.map((p) => p.url)))
  const [domainVerified, setDomainVerified] = useState(!requiresVerification)
  const [confirming, setConfirming] = useState(false)
  const [confirmError, setConfirmError] = useState<string | null>(null)

  const domain = useMemo(() => {
    try {
      return new URL(sourceUrl).hostname
    } catch {
      return sourceUrl
    }
  }, [sourceUrl])

  const allChecked = checked.size === pages.length
  const noneChecked = checked.size === 0

  function togglePage(url: string) {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(url)) {
        next.delete(url)
      } else {
        next.add(url)
      }
      return next
    })
  }

  function selectAll() {
    setChecked(new Set(pages.map((p) => p.url)))
  }

  function deselectAll() {
    setChecked(new Set())
  }

  const canStart = domainVerified && !noneChecked && !confirming

  async function handleConfirm() {
    if (!canStart) return
    setConfirming(true)
    setConfirmError(null)

    try {
      const res = await fetch('/api/crawl/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          crawlJobId,
          approvedUrls: Array.from(checked),
        }),
      })
      const data = (await res.json()) as ConfirmResponse
      if (!res.ok) {
        setConfirmError(data.error ?? `Request failed (HTTP ${res.status})`)
        setConfirming(false)
        return
      }
      onConfirmed(crawlJobId)
    } catch {
      setConfirmError('Failed to start the crawl. Please try again.')
      setConfirming(false)
    }
  }

  // Sort pages: high → medium → low
  const priorityOrder = { high: 0, medium: 1, low: 2 }
  const sortedPages = [...pages].sort(
    (a, b) =>
      (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2)
  )

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm font-medium text-foreground">{t('discoveryTitle')}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{t('discoveryDescription')}</p>
      </div>

      {requiresVerification && (
        <DomainVerification domain={domain} onVerified={() => setDomainVerified(true)} />
      )}

      {/* Select/deselect controls */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {checked.size} of {pages.length} pages selected
        </p>
        <div className="flex items-center gap-3">
          {!allChecked && (
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={selectAll}
              className="h-auto p-0 text-primary"
            >
              {t('selectAll')}
            </Button>
          )}
          {!noneChecked && (
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={deselectAll}
              className="h-auto p-0 text-muted-foreground hover:text-foreground"
            >
              {t('deselectAll')}
            </Button>
          )}
        </div>
      </div>

      {/* Page list */}
      <div className="bg-card border rounded-lg divide-y max-h-72 overflow-y-auto">
        {sortedPages.map((page) => {
          const isChecked = checked.has(page.url)
          return (
            <label
              key={page.url}
              className={cn(
                'flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-muted transition-colors',
                !isChecked && 'opacity-50'
              )}
            >
              <Checkbox
                checked={isChecked}
                onCheckedChange={() => togglePage(page.url)}
                className="mt-0.5 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-foreground truncate">{page.anchorText || page.url}</span>
                  <PriorityBadge priority={page.priority} />
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{page.url}</p>
                {page.reason && (
                  <p className="text-xs text-muted-foreground/80 mt-0.5 italic">{page.reason}</p>
                )}
              </div>
            </label>
          )
        })}
      </div>

      {confirmError && (
        <div className="flex items-start gap-2 bg-card border border-red-200 dark:border-red-800 rounded-lg px-4 py-3">
          <span className="text-destructive text-base mt-0.5" aria-hidden="true">
            &#x2715;
          </span>
          <p className="text-xs text-muted-foreground break-words">{confirmError}</p>
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          {t('cancel')}
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={handleConfirm}
          disabled={!canStart}
          className="disabled:opacity-40"
        >
          {confirming && (
            <span
              className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"
              aria-hidden="true"
            />
          )}
          {checked.size > 0
            ? t('startDeepCrawlSelected', { count: checked.size })
            : t('startDeepCrawl')}
        </Button>
      </div>
    </div>
  )
}
