'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import type { WorkspacePlan } from '@/lib/cloud'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

interface Props {
  workspaceId: string
  userEmail: string
  role: string
  plan: WorkspacePlan | null
  customDomain: string | null
  liveArticleCount: number
  liveMemberCount: number
}

const PLAN_DISPLAY = {
  FREE:     { articles: '25',        members: '3',  aiCredits: '100',  apiCalls: '1K' },
  PRO:      { articles: '500',       members: '10', aiCredits: '2K',   apiCalls: '50K' },
  BUSINESS: { articles: 'Unlimited', members: '50', aiCredits: '10K',  apiCalls: '500K' },
}

function usePlans() {
  const t = useTranslations('billing')
  return [
    { key: 'FREE' as const, name: t('planFree'), price: '$0', period: t('forever'), description: t('planFreeDescription'), featured: false },
    { key: 'PRO' as const, name: t('planPro'), price: '$19', period: t('perMonth'), description: t('planProDescription'), featured: true },
    { key: 'BUSINESS' as const, name: t('planBusiness'), price: '$79', period: t('perMonth'), description: t('planBusinessDescription'), featured: false },
  ]
}

function useFeatures() {
  const t = useTranslations('billing')
  return [
    { label: t('articles'), key: 'articles' as const },
    { label: t('teamMembers'), key: 'members' as const },
    { label: t('aiCreditsPerMonth'), key: 'aiCredits' as const },
    { label: t('apiCallsPerMonth'), key: 'apiCalls' as const },
  ]
}

function UsageMeter({ label, current, limit }: { label: string; current: number; limit: number }) {
  const unlimited = limit === -1 || limit === Infinity
  const pct = unlimited ? 0 : Math.min((current / limit) * 100, 100)
  const warn = !unlimited && pct > 80

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className={warn ? 'text-orange-600 font-medium' : 'text-foreground'}>
          {current.toLocaleString()}
          {unlimited ? ' / ∞' : ` / ${limit.toLocaleString()}`}
        </span>
      </div>
      <Progress
        value={unlimited ? 0 : pct}
        className={warn ? '[&>div]:bg-orange-500' : '[&>div]:bg-emerald-600'}
      />
    </div>
  )
}

export function BillingContent({ workspaceId, userEmail, role, plan, customDomain, liveArticleCount, liveMemberCount }: Props) {
  const t = useTranslations('billing')
  const tc = useTranslations('common')
  const PLANS = usePlans()
  const FEATURES = useFeatures()
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
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-medium">{t('currentUsage')}</CardTitle>
                <CardDescription>
                  {t('planResets', { plan: tier.charAt(0) + tier.slice(1).toLowerCase() })}
                </CardDescription>
              </div>
              <Badge variant="secondary" className="uppercase tracking-wide">
                {tier}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <UsageMeter label={t('articles')}   current={liveArticleCount}  limit={(limits?.articles as number) ?? 25} />
              <UsageMeter label={t('members')}    current={liveMemberCount}   limit={(limits?.members as number) ?? 3} />
              <UsageMeter label={t('aiCredits')} current={usage?.aiCredits ?? 0} limit={(limits?.aiCredits as number) ?? 100} />
              <UsageMeter label={t('apiCalls')}  current={usage?.apiCalls ?? 0}  limit={(limits?.apiCalls as number) ?? 1000} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Plan cards */}
      <section>
        <h2 className="text-base font-semibold text-foreground mb-6">{t('choosePlan')}</h2>
        <div className="grid gap-5 grid-cols-1 md:grid-cols-3">
          {PLANS.map((p, idx) => {
            const isCurrent = p.key === tier
            const currentIdx = PLANS.findIndex((x) => x.key === tier)
            const isUpgrade = idx > currentIdx
            const isDowngrade = idx < currentIdx
            const canChange = isOwner && !isCurrent && p.key !== 'FREE'

            return (
              <Card
                key={p.key}
                className={`relative flex flex-col ${
                  p.featured
                    ? 'border-primary/50 shadow-sm ring-1 ring-primary/20'
                    : ''
                }`}
              >
                {p.featured && !isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1">
                      {t('mostPopular')}
                    </Badge>
                  </div>
                )}
                {isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-emerald-600 text-white text-xs font-semibold px-3 py-1">
                      {t('currentPlan')}
                    </Badge>
                  </div>
                )}

                <CardHeader className="pb-0">
                  <CardTitle className="text-base font-semibold">{p.name}</CardTitle>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-2xl font-semibold text-foreground">{p.price}</span>
                    <span className="text-muted-foreground text-sm">/{p.period}</span>
                  </div>
                  <CardDescription className="mt-2">{p.description}</CardDescription>
                </CardHeader>

                <CardContent className="flex-1 flex flex-col pt-4">
                  <ul className="space-y-3 flex-1 mb-8">
                    {FEATURES.map((f) => (
                      <li key={f.key} className="flex items-center gap-2 text-sm">
                        <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-muted-foreground">{f.label}:</span>
                        <span className="text-foreground font-medium">{PLAN_DISPLAY[p.key][f.key]}</span>
                      </li>
                    ))}
                  </ul>

                  {isCurrent ? (
                    <Button variant="secondary" disabled className="w-full">
                      {t('currentPlan')}
                    </Button>
                  ) : canChange && isUpgrade ? (
                    <Button
                      onClick={() => handleUpgrade(p.key as 'PRO' | 'BUSINESS')}
                      disabled={loading !== null}
                      variant={p.featured ? 'default' : 'outline'}
                      className="w-full"
                    >
                      {loading === p.key ? t('redirecting') : t('upgradeToName', { name: p.name })}
                    </Button>
                  ) : isDowngrade ? (
                    <p className="w-full text-center text-xs text-muted-foreground py-2.5">
                      {t('manageViaPortal')}
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>

      {/* Manage subscription */}
      {tier !== 'FREE' && isOwner && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">{t('manageSubscription')}</CardTitle>
            <CardDescription>{t('manageSubscriptionDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={handlePortal}
              disabled={loading !== null}
            >
              {loading === 'portal' ? t('opening') : t('openBillingPortal')}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Custom domain downgrade warning dialog */}
      <Dialog open={showDomainWarning} onOpenChange={(open) => { if (!open) setShowDomainWarning(false) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('domainWarningTitle')}</DialogTitle>
            <DialogDescription>
              {t('domainWarningMessage', { domain: customDomain ?? '' })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDomainWarning(false)}>{tc('cancel')}</Button>
            <Button onClick={handlePortal}>{t('continueToBilling')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
