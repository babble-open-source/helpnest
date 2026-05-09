'use client'

import { useState, useEffect, useRef } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { CrawlStep } from '../onboarding/CrawlStep'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+/g, '')
}

function cleanSlug(str: string): string {
  return slugify(str).replace(/-+$/g, '')
}

interface Props {
  slugPrefix: string
  slugSuffix: string
  onClose: () => void
}

export function CreateWorkspaceModal({ slugPrefix, slugSuffix, onClose }: Props) {
  const locale = useLocale()
  const t = useTranslations('onboarding')
  const tc = useTranslations('crawl')
  const [step, setStep] = useState<'workspace' | 'crawl'>('workspace')
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!slugEdited) setSlug(cleanSlug(name))
  }, [name, slugEdited])

  useEffect(() => {
    if (step === 'workspace') nameInputRef.current?.focus()
  }, [step])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || slug.trim().length < 3) return

    const finalSlug = cleanSlug(slug)
    if (finalSlug.length < 3) {
      setError(t('slugHint'))
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/workspaces/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), slug: finalSlug }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? tc('importFailed'))
        setLoading(false)
        return
      }

      setLoading(false)
      setStep('crawl')
    } catch {
      setError(tc('connectionError'))
      setLoading(false)
    }
  }

  function goToDashboard() {
    window.location.assign(`/${locale}`)
  }

  if (step === 'crawl') {
    return (
      <Dialog open onOpenChange={(open) => { if (!open) goToDashboard() }}>
        <DialogContent className="dashboard-root sm:max-w-md">
          <CrawlStep onSkip={goToDashboard} onComplete={goToDashboard} compact />
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="dashboard-root sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-sans text-base font-medium tracking-normal text-foreground">{t('title')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div>
            <label htmlFor="ws-name" className="block text-xs font-medium text-foreground mb-1.5">
              {t('helpCenterName')}
            </label>
            <Input
              ref={nameInputRef}
              id="ws-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('helpCenterNamePlaceholder')}
            />
          </div>

          <div>
            <label htmlFor="ws-slug" className="block text-xs font-medium text-foreground mb-1.5">
              {t('urlSlug')}
            </label>
            <div className="flex items-center">
              {slugPrefix && (
                <span className="text-sm text-muted-foreground bg-muted border border-input border-r-0 rounded-l-md px-3 py-2 whitespace-nowrap">
                  {slugPrefix}
                </span>
              )}
              <Input
                id="ws-slug"
                type="text"
                required
                value={slug}
                onChange={(e) => {
                  setSlug(slugify(e.target.value))
                  setSlugEdited(true)
                }}
                onBlur={() => setSlug(cleanSlug(slug))}
                className={`${slugPrefix ? 'rounded-l-none' : ''} ${slugSuffix ? 'rounded-r-none' : ''}`}
                placeholder={t('slugPlaceholder')}
              />
              {slugSuffix && (
                <span className="text-sm text-muted-foreground bg-muted border border-input border-l-0 rounded-r-md px-3 py-2 whitespace-nowrap">
                  {slugSuffix}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{t('slugHint')}</p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {tc('cancel')}
            </Button>
            <Button
              type="submit"
              disabled={loading || !name.trim() || slug.trim().length < 3}
            >
              {loading ? t('creating') : t('createButton')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
