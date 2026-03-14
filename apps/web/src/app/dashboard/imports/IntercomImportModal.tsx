'use client'

import { useState } from 'react'
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

export function IntercomImportModal({ onClose }: Props) {
  const [step, setStep] = useState<Step>('form')
  const [token, setToken] = useState('')
  const [status, setStatus] = useState<'DRAFT' | 'PUBLISHED'>('DRAFT')
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!token.trim()) return
    setStep('importing')
    setError('')
    try {
      const res = await fetch('/api/imports/intercom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim(), status }),
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
          <h2 className="font-medium text-ink">Import from Intercom</h2>
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
                Access Token <span className="text-accent">*</span>
              </label>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Your Intercom access token"
                autoComplete="off"
                required
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent bg-white text-ink"
              />
              <p className="text-xs text-muted mt-1.5">
                Find your token in Intercom Settings → Developers → Your apps.
              </p>
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
                      name="intercom-status"
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
                disabled={!token.trim()}
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
            <p className="text-sm text-ink font-medium">Importing from Intercom…</p>
            <p className="text-xs text-muted text-center">
              Fetching articles and collections. This may take a moment.
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
