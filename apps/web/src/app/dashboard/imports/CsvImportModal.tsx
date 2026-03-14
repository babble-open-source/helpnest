'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'

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
        setError(data.error ?? 'Import failed')
        setStep('form')
        return
      }
      setResult(data)
      setStep('done')
    } catch {
      setError('Something went wrong. Please try again.')
      setStep('form')
    }
  }

  return (
    <div
      className="fixed inset-0 bg-ink/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-lg w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-medium text-ink">Import CSV / Markdown</h2>
          <button
            onClick={onClose}
            className="text-muted hover:text-ink transition-colors text-lg leading-none"
            aria-label="Close"
          >
            &#x2715;
          </button>
        </div>

        {step === 'form' && (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted uppercase tracking-wide mb-1.5">
                File <span className="text-accent">*</span>
              </label>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                  dragOver
                    ? 'border-accent bg-accent/5'
                    : 'border-border hover:border-ink/30'
                }`}
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
                    <svg className="w-4 h-4 text-accent shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="text-sm text-ink font-medium truncate max-w-xs">{file.name}</span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setFile(null) }}
                      className="text-muted hover:text-ink transition-colors ml-1 shrink-0"
                      aria-label="Remove file"
                    >
                      &#x2715;
                    </button>
                  </div>
                ) : (
                  <>
                    <svg className="w-8 h-8 text-muted mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="text-sm text-ink">Drop a file or click to browse</p>
                    <p className="text-xs text-muted mt-1">.csv, .md, .txt</p>
                  </>
                )}
              </div>
              <div className="mt-2 text-xs text-muted space-y-0.5">
                <p>CSV columns: <code className="bg-cream px-1 rounded text-ink">title</code>, <code className="bg-cream px-1 rounded text-ink">content</code>, <code className="bg-cream px-1 rounded text-ink">excerpt</code> (optional), <code className="bg-cream px-1 rounded text-ink">collection</code> (optional)</p>
                <p>Markdown: each file becomes one article. Filename becomes the title.</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted uppercase tracking-wide mb-1.5">
                Import as
              </label>
              <div className="flex gap-4">
                {(['DRAFT', 'PUBLISHED'] as const).map((s) => (
                  <label key={s} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="csv-status"
                      value={s}
                      checked={status === s}
                      onChange={() => setStatus(s)}
                      className="accent-accent"
                    />
                    <span className="text-sm text-ink">{s === 'DRAFT' ? 'Draft' : 'Published'}</span>
                  </label>
                ))}
              </div>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-muted hover:text-ink transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!file}
                className="bg-ink text-cream px-4 py-2 rounded-lg text-sm font-medium hover:bg-ink/90 transition-colors disabled:opacity-50"
              >
                Start Import
              </button>
            </div>
          </form>
        )}

        {step === 'importing' && (
          <div className="p-6 flex flex-col items-center gap-4 py-10">
            <div className="w-8 h-8 border-2 border-ink/20 border-t-ink rounded-full animate-spin" />
            <p className="text-sm text-ink font-medium">Importing file…</p>
            <p className="text-xs text-muted text-center">
              Parsing rows and creating articles. This may take a moment.
            </p>
          </div>
        )}

        {step === 'done' && result && (
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3 p-3 bg-green/10 rounded-lg border border-green/20">
              <svg className="w-5 h-5 text-green shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-sm font-medium text-ink">Import complete</p>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-cream rounded-lg p-3">
                <p className="text-2xl font-serif text-ink">{result.collectionsCreated}</p>
                <p className="text-xs text-muted mt-0.5">Collections</p>
              </div>
              <div className="bg-cream rounded-lg p-3">
                <p className="text-2xl font-serif text-ink">{result.articlesCreated}</p>
                <p className="text-xs text-muted mt-0.5">Articles</p>
              </div>
              <div className="bg-cream rounded-lg p-3">
                <p className="text-2xl font-serif text-ink">{result.errors.length}</p>
                <p className="text-xs text-muted mt-0.5">Errors</p>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="bg-red-50 border border-red-100 rounded-lg p-3 space-y-1 max-h-32 overflow-y-auto">
                {result.errors.map((err, i) => (
                  <p key={i} className="text-xs text-red-600">{err}</p>
                ))}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-muted hover:text-ink transition-colors"
              >
                Close
              </button>
              <Link
                href="/dashboard/articles"
                className="bg-ink text-cream px-4 py-2 rounded-lg text-sm font-medium hover:bg-ink/90 transition-colors"
                onClick={onClose}
              >
                View articles →
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
