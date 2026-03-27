'use client'

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import type { DiscoveryPage } from './CrawlModal'

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

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-accent/10 text-accent',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-border text-muted',
}

function PriorityBadge({ priority }: { priority: string }) {
  const t = useTranslations('crawl')
  const label =
    priority === 'high'
      ? t('priorityHigh')
      : priority === 'medium'
        ? t('priorityMedium')
        : t('priorityLow')

  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium capitalize shrink-0 ${PRIORITY_COLORS[priority] ?? PRIORITY_COLORS.low}`}
    >
      {label}
    </span>
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
      <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
        <svg
          className="text-green-600 shrink-0"
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
        <p className="text-sm font-medium text-green-800">{t('verifyDomainSuccess')}</p>
      </div>
    )
  }

  if (step === 'idle') {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex flex-col gap-2">
        <p className="text-sm font-medium text-ink">{t('verifyDomainHeading')}</p>
        <p className="text-xs text-muted">{t('verifyDomainDescription', { domain })}</p>
        <button
          type="button"
          onClick={initiateVerification}
          className="self-start text-xs font-medium text-accent hover:underline"
        >
          Get verification code
        </button>
      </div>
    )
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex flex-col gap-3">
      <p className="text-sm font-medium text-ink">{t('verifyDomainHeading')}</p>
      {instructions && <p className="text-xs text-muted">{instructions}</p>}
      {metaTag && (
        <div className="flex items-stretch gap-2">
          <code className="flex-1 text-xs bg-white border border-border rounded px-3 py-2 font-mono text-ink break-all">
            {metaTag}
          </code>
          <button
            type="button"
            onClick={() => copyToClipboard(metaTag)}
            className="shrink-0 text-xs font-medium px-3 py-2 rounded border border-border bg-white hover:bg-cream text-ink transition-colors"
          >
            {copied ? t('verifyDomainCopied') : t('verifyDomainCopy')}
          </button>
        </div>
      )}
      {checkError && <p className="text-xs text-red-600">{checkError}</p>}
      <button
        type="button"
        onClick={checkVerification}
        disabled={step === 'checking'}
        className="self-start text-xs font-medium bg-accent text-white px-3 py-1.5 rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50"
      >
        {step === 'checking' ? t('verifyDomainChecking') : t('verifyDomainCheck')}
      </button>
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
        <p className="text-sm font-medium text-ink">{t('discoveryTitle')}</p>
        <p className="text-xs text-muted mt-0.5">{t('discoveryDescription')}</p>
      </div>

      {requiresVerification && (
        <DomainVerification domain={domain} onVerified={() => setDomainVerified(true)} />
      )}

      {/* Select/deselect controls */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted">
          {checked.size} of {pages.length} pages selected
        </p>
        <div className="flex items-center gap-3">
          {!allChecked && (
            <button
              type="button"
              onClick={selectAll}
              className="text-xs text-accent hover:underline"
            >
              {t('selectAll')}
            </button>
          )}
          {!noneChecked && (
            <button
              type="button"
              onClick={deselectAll}
              className="text-xs text-muted hover:text-ink"
            >
              {t('deselectAll')}
            </button>
          )}
        </div>
      </div>

      {/* Page list */}
      <div className="bg-white border border-border rounded-lg divide-y divide-border max-h-72 overflow-y-auto">
        {sortedPages.map((page) => {
          const isChecked = checked.has(page.url)
          return (
            <label
              key={page.url}
              className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-cream transition-colors ${
                isChecked ? '' : 'opacity-50'
              }`}
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => togglePage(page.url)}
                className="mt-0.5 accent-accent shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-ink truncate">{page.anchorText || page.url}</span>
                  <PriorityBadge priority={page.priority} />
                </div>
                <p className="text-xs text-muted truncate mt-0.5">{page.url}</p>
                {page.reason && (
                  <p className="text-xs text-muted/80 mt-0.5 italic">{page.reason}</p>
                )}
              </div>
            </label>
          )
        })}
      </div>

      {confirmError && (
        <div className="flex items-start gap-2 bg-white border border-red-200 rounded-lg px-4 py-3">
          <span className="text-red-500 text-base mt-0.5" aria-hidden="true">
            &#x2715;
          </span>
          <p className="text-xs text-muted break-words">{confirmError}</p>
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-muted hover:text-ink transition-colors px-4 py-2 rounded-lg border border-border bg-white hover:bg-cream"
        >
          {t('cancel')}
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!canStart}
          className="bg-accent text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
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
        </button>
      </div>
    </div>
  )
}
