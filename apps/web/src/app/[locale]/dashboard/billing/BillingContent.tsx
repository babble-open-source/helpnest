'use client'

import { useState } from 'react'
import type { WorkspacePlan } from '@/lib/cloud'

interface Props {
  workspaceId: string
  userEmail: string
  role: string
  plan: WorkspacePlan | null
  customDomain: string | null
}

const PLAN_DISPLAY = {
  FREE:     { articles: '25',        members: '3',  aiCredits: '100',  apiCalls: '1K' },
  PRO:      { articles: '500',       members: '10', aiCredits: '2K',   apiCalls: '50K' },
  BUSINESS: { articles: 'Unlimited', members: '50', aiCredits: '10K',  apiCalls: '500K' },
}

const PLANS = [
  { key: 'FREE' as const, name: 'Free', price: '$0', period: 'forever', description: 'Perfect for small teams getting started', featured: false },
  { key: 'PRO' as const, name: 'Pro', price: '$19', period: 'per month', description: 'For growing teams that need more power', featured: true },
  { key: 'BUSINESS' as const, name: 'Business', price: '$79', period: 'per month', description: 'Unlimited scale for large support operations', featured: false },
]

const FEATURES = [
  { label: 'Articles', key: 'articles' as const },
  { label: 'Team members', key: 'members' as const },
  { label: 'AI credits / mo', key: 'aiCredits' as const },
  { label: 'API calls / mo', key: 'apiCalls' as const },
]

function UsageMeter({ label, current, limit }: { label: string; current: number; limit: number }) {
  const unlimited = limit === -1 || limit === Infinity
  const pct = unlimited ? 0 : Math.min((current / limit) * 100, 100)
  const warn = !unlimited && pct > 80

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="text-muted">{label}</span>
        <span className={warn ? 'text-accent font-medium' : 'text-ink'}>
          {current.toLocaleString()}
          {unlimited ? ' / \u221E' : ` / ${limit.toLocaleString()}`}
        </span>
      </div>
      <div className="h-1.5 bg-border rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${warn ? 'bg-accent' : 'bg-green'}`}
          style={{ width: unlimited ? '0%' : `${pct}%` }}
        />
      </div>
    </div>
  )
}

export function BillingContent({ workspaceId, userEmail, role, plan, customDomain }: Props) {
  const [loading, setLoading] = useState<string | null>(null)
  const [showDomainWarning, setShowDomainWarning] = useState(false)
  const tier = plan?.plan ?? 'FREE'
  const usage = plan?.usage
  const limits = plan?.limits

  function navigateTo(url: string) {
    window.location.assign(url)
  }

  async function handleUpgrade(targetPlan: 'PRO' | 'BUSINESS') {
    setLoading(targetPlan)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, plan: targetPlan, email: userEmail }),
      })
      const data = await res.json()
      if (data.url) {
        navigateTo(data.url)
      }
    } catch {
      setLoading(null)
    }
  }

  async function handlePortal() {
    // Warn if workspace has a custom domain that will be lost on downgrade
    if (customDomain && !showDomainWarning) {
      setShowDomainWarning(true)
      return
    }
    setShowDomainWarning(false)
    setLoading('portal')
    try {
      const res = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId }),
      })
      const data = await res.json()
      if (data.url) {
        navigateTo(data.url)
      }
    } catch {
      setLoading(null)
    }
  }

  const isOwner = role === 'OWNER'

  return (
    <div className="space-y-10">
      {/* Usage meters */}
      {plan && (
        <section className="bg-white rounded-xl border border-border p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-medium text-ink">Current usage</h2>
              <p className="text-sm text-muted mt-0.5">
                {tier.charAt(0) + tier.slice(1).toLowerCase()} plan &middot; Resets monthly
              </p>
            </div>
            <span className="text-xs font-medium uppercase tracking-wide bg-border text-ink px-2.5 py-1 rounded-full">
              {tier}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <UsageMeter label="Articles"   current={usage?.articles ?? 0}  limit={(limits?.articles as number) ?? 25} />
            <UsageMeter label="Members"    current={usage?.members ?? 0}   limit={(limits?.members as number) ?? 3} />
            <UsageMeter label="AI credits" current={usage?.aiCredits ?? 0} limit={(limits?.aiCredits as number) ?? 100} />
            <UsageMeter label="API calls"  current={usage?.apiCalls ?? 0}  limit={(limits?.apiCalls as number) ?? 1000} />
          </div>
        </section>
      )}

      {/* Plan cards */}
      <section>
        <h2 className="font-serif text-xl text-ink mb-6">Choose a plan</h2>
        <div className="grid gap-5 grid-cols-1 md:grid-cols-3">
          {PLANS.map((p, idx) => {
            const isCurrent = p.key === tier
            const currentIdx = PLANS.findIndex((x) => x.key === tier)
            const isUpgrade = idx > currentIdx
            const isDowngrade = idx < currentIdx
            const canChange = isOwner && !isCurrent && p.key !== 'FREE'

            return (
              <div
                key={p.key}
                className={`rounded-xl border p-6 flex flex-col relative bg-white ${
                  p.featured
                    ? 'border-accent shadow-sm ring-1 ring-accent/20'
                    : 'border-border'
                }`}
              >
                {p.featured && !isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-accent text-white text-xs font-semibold px-3 py-1 rounded-full">
                      Most popular
                    </span>
                  </div>
                )}
                {isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-green text-white text-xs font-semibold px-3 py-1 rounded-full">
                      Current plan
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="font-serif text-xl text-ink">{p.name}</h3>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-3xl font-semibold text-ink">{p.price}</span>
                    <span className="text-muted text-sm">/{p.period}</span>
                  </div>
                  <p className="text-sm text-muted mt-2">{p.description}</p>
                </div>

                <ul className="space-y-3 flex-1 mb-8">
                  {FEATURES.map((f) => (
                    <li key={f.key} className="flex items-center gap-2 text-sm">
                      <svg className="w-4 h-4 text-green flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-muted">{f.label}:</span>
                      <span className="text-ink font-medium">{PLAN_DISPLAY[p.key][f.key]}</span>
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <button
                    disabled
                    className="w-full text-center py-2.5 px-4 rounded-lg text-sm font-medium bg-cream text-muted border border-border cursor-not-allowed"
                  >
                    Current plan
                  </button>
                ) : canChange && isUpgrade ? (
                  <button
                    onClick={() => handleUpgrade(p.key as 'PRO' | 'BUSINESS')}
                    disabled={loading !== null}
                    className={`w-full text-center py-2.5 px-4 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                      p.featured
                        ? 'bg-accent text-white hover:bg-accent/90'
                        : 'border border-border text-ink hover:bg-cream'
                    }`}
                  >
                    {loading === p.key ? 'Redirecting\u2026' : `Upgrade to ${p.name}`}
                  </button>
                ) : isDowngrade ? (
                  <p className="w-full text-center text-xs text-muted py-2.5">
                    Manage via billing portal below
                  </p>
                ) : null}
              </div>
            )
          })}
        </div>
      </section>

      {/* Manage subscription */}
      {tier !== 'FREE' && isOwner && (
        <section className="bg-white rounded-xl border border-border p-6">
          <h2 className="font-medium text-ink mb-2">Manage subscription</h2>
          <p className="text-sm text-muted mb-4">
            Update your payment method, download invoices, or cancel your subscription.
          </p>
          <button
            onClick={handlePortal}
            disabled={loading !== null}
            className="text-sm font-medium border border-border text-ink px-4 py-2 rounded-lg hover:bg-cream transition-colors disabled:opacity-50"
          >
            {loading === 'portal' ? 'Opening\u2026' : 'Open billing portal'}
          </button>
        </section>
      )}

      {/* Custom domain downgrade warning modal */}
      {showDomainWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40">
          <div className="bg-white rounded-xl border border-border shadow-lg p-6 max-w-md mx-4">
            <h3 className="font-serif text-lg text-ink mb-2">Custom domain warning</h3>
            <p className="text-sm text-muted mb-4">
              Your custom domain <span className="font-medium text-ink">{customDomain}</span> will
              stop working immediately if you downgrade to the Free plan.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDomainWarning(false)}
                className="text-sm font-medium px-4 py-2 rounded-lg border border-border text-ink hover:bg-cream transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handlePortal}
                className="text-sm font-medium px-4 py-2 rounded-lg bg-accent text-white hover:bg-accent/90 transition-colors"
              >
                Continue to billing portal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
