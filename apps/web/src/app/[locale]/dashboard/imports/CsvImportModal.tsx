'use client'

import { useRef, useState } from 'react'
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
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface ImportResult {
  collectionsCreated: number
  articlesCreated: number
  errors: string[]
}

interface Props {
  onClose: () => void
}

type Step = 'form' | 'importing' | 'done'

export function CsvImportModal({ onClose }: Props) {
  const t = useTranslations('importModal')
  const tc = useTranslations('common')
  const [step, setStep] = useState<Step>('form')
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [status, setStatus] = useState<'DRAFT' | 'PUBLISHED'>('DRAFT')
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) setFile(dropped)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return
    setStep('importing')
    setError('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('status', status)
      const res = await fetch('/api/imports/csv', {
        method: 'POST',
        body: formData,
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
          <DialogTitle>{t('importFrom', { source: 'CSV / Markdown' })}</DialogTitle>
          <DialogDescription className="sr-only">{t('importFrom', { source: 'CSV / Markdown' })}</DialogDescription>
        </DialogHeader>

        {step === 'form' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>
                File <span className="text-destructive">*</span>
              </Label>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors',
                  dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/50'
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.md,.txt"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                {file ? (
                  <div className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="text-sm text-foreground font-medium truncate max-w-xs">{file.name}</span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setFile(null) }}
                      className="text-muted-foreground hover:text-foreground transition-colors ml-1 shrink-0"
                      aria-label="Remove file"
                    >
                      &#x2715;
                    </button>
                  </div>
                ) : (
                  <>
                    <svg className="w-8 h-8 text-muted-foreground mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="text-sm text-foreground">Drop a file or click to browse</p>
                    <p className="text-xs text-muted-foreground mt-1">.csv, .md, .txt</p>
                  </>
                )}
              </div>
              <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
                <p>CSV columns: <code className="bg-muted px-1 rounded text-foreground">title</code>, <code className="bg-muted px-1 rounded text-foreground">content</code>, <code className="bg-muted px-1 rounded text-foreground">excerpt</code> (optional), <code className="bg-muted px-1 rounded text-foreground">collection</code> (optional)</p>
                <p>Markdown: each file becomes one article. Filename becomes the title.</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{t('importAs')}</Label>
              <div className="flex gap-4">
                {(['DRAFT', 'PUBLISHED'] as const).map((s) => (
                  <label key={s} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="csv-status"
                      value={s}
                      checked={status === s}
                      onChange={() => setStatus(s)}
                      className="accent-primary"
                    />
                    <span className="text-sm text-foreground">{s === 'DRAFT' ? tc('draft') : tc('published')}</span>
                  </label>
                ))}
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose}>{tc('cancel')}</Button>
              <Button type="submit" disabled={!file}>{t('startImport')}</Button>
            </DialogFooter>
          </form>
        )}

        {step === 'importing' && (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="w-8 h-8 border-2 border-muted border-t-foreground rounded-full animate-spin" />
            <p className="text-sm font-medium text-foreground">{t('importing', { source: 'CSV / Markdown' })}</p>
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
                <Link href="/dashboard/articles" onClick={onClose}>{t('viewArticles')}</Link>
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
