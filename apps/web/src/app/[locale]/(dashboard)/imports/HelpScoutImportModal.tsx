'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

interface ImportResult {
  collectionsCreated: number
  articlesCreated: number
  errors: string[]
}

interface Props {
  onClose: () => void
}

type Step = 'form' | 'importing' | 'done'

export function HelpScoutImportModal({ onClose }: Props) {
  const t = useTranslations('importModal')
  const tc = useTranslations('common')
  const [step, setStep] = useState<Step>('form')
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [status, setStatus] = useState<'DRAFT' | 'PUBLISHED'>('DRAFT')
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!clientId.trim() || !clientSecret.trim()) return
    setStep('importing')
    setError('')
    try {
      const res = await fetch('/api/imports/helpscout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: clientId.trim(),
          clientSecret: clientSecret.trim(),
          status,
        }),
      })
      const data = await res.json() as ImportResult & { error?: string }
      if (!res.ok) {
        setError(data.error ?? t('importFailed'))
        setStep('form')
        return
      }
      setResult(data)
      setStep('done')
    } catch {
      setError(tc('somethingWentWrong'))
      setStep('form')
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('importFrom', { source: 'Help Scout' })}</DialogTitle>
          <DialogDescription className="sr-only">{t('importFrom', { source: 'Help Scout' })}</DialogDescription>
        </DialogHeader>

        {step === 'form' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="helpscout-clientid">
                Client ID <span className="text-destructive">*</span>
              </Label>
              <Input
                id="helpscout-clientid"
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="Your OAuth2 client ID"
                autoComplete="off"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="helpscout-secret">
                Client Secret <span className="text-destructive">*</span>
              </Label>
              <Input
                id="helpscout-secret"
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder="Your OAuth2 client secret"
                autoComplete="off"
                required
              />
              <p className="text-xs text-muted-foreground">
                Your Account → Your Profile → Authentication → OAuth Applications.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>{t('importAs')}</Label>
              <ToggleGroup
                type="single"
                value={status}
                onValueChange={(value) => { if (value) setStatus(value as 'DRAFT' | 'PUBLISHED') }}
                className="justify-start"
              >
                <ToggleGroupItem value="DRAFT" className="text-sm">{tc('draft')}</ToggleGroupItem>
                <ToggleGroupItem value="PUBLISHED" className="text-sm">{tc('published')}</ToggleGroupItem>
              </ToggleGroup>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose}>{tc('cancel')}</Button>
              <Button type="submit" disabled={!clientId.trim() || !clientSecret.trim()}>{t('startImport')}</Button>
            </DialogFooter>
          </form>
        )}

        {step === 'importing' && (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="w-8 h-8 border-2 border-muted border-t-foreground rounded-full animate-spin" />
            <p className="text-sm font-medium text-foreground">{t('importing', { source: 'Help Scout' })}</p>
            <p className="text-xs text-muted-foreground text-center">{t('importingHelp')}</p>
          </div>
        )}

        {step === 'done' && result && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
              <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-sm font-medium text-foreground">{t('importComplete')}</p>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-muted rounded-lg p-3">
                <p className="text-2xl font-semibold text-foreground">{result.collectionsCreated}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{tc('collections', { count: result.collectionsCreated })}</p>
              </div>
              <div className="bg-muted rounded-lg p-3">
                <p className="text-2xl font-semibold text-foreground">{result.articlesCreated}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{tc('articles', { count: result.articlesCreated })}</p>
              </div>
              <div className="bg-muted rounded-lg p-3">
                <p className="text-2xl font-semibold text-foreground">{result.errors.length}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t('errors')}</p>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3 space-y-1 max-h-32 overflow-y-auto">
                {result.errors.map((err, i) => (
                  <p key={i} className="text-xs text-destructive">{err}</p>
                ))}
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose}>{tc('close')}</Button>
              <Button asChild>
                <Link href="/articles" onClick={onClose}>{t('viewArticles')}</Link>
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
