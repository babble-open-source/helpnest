'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations, useFormatter } from 'next-intl'

interface ApiKey {
  id: string
  name: string
  createdAt: string
  lastUsedAt: string | null
}

export function ApiKeysSection({ demoMode = false }: { demoMode?: boolean }) {
  const t = useTranslations('apiKeys')
  const tc = useTranslations('common')
  const tm = useTranslations('members')
  const tca = useTranslations('collectionsActions')
  const format = useFormatter()

  function formatDate(iso: string | null): string {
    if (!iso) return t('never')
    return format.dateTime(new Date(iso), { year: 'numeric', month: 'short', day: 'numeric' })
  }
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [newRawKey, setNewRawKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch('/api/api-keys')
      if (!res.ok) throw new Error(tc('somethingWentWrong'))
      const data = await res.json() as { keys: ApiKey[] }
      setKeys(data.keys)
    } catch (e) {
      setError(e instanceof Error ? e.message : tc('somethingWentWrong'))
    } finally {
      setLoading(false)
    }
  }, [tc])

  useEffect(() => {
    void fetchKeys()
  }, [fetchKeys])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const name = newKeyName.trim()
    if (!name) return
    setCreating(true)
    setError(null)
    try {
      const res = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) {
        const body = await res.json() as { error?: string }
        throw new Error(body.error ?? tc('somethingWentWrong'))
      }
      const created = await res.json() as { id: string; name: string; createdAt: string; key: string }
      setNewRawKey(created.key)
      setNewKeyName('')
      await fetchKeys()
    } catch (e) {
      setError(e instanceof Error ? e.message : tc('somethingWentWrong'))
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(t('confirmDelete', { name }))) return
    setDeletingId(id)
    setError(null)
    try {
      const res = await fetch(`/api/api-keys/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json() as { error?: string }
        throw new Error(body.error ?? tc('somethingWentWrong'))
      }
      setKeys((prev) => prev.filter((k) => k.id !== id))
    } catch (e) {
      setError(e instanceof Error ? e.message : tc('somethingWentWrong'))
    } finally {
      setDeletingId(null)
    }
  }

  async function handleCopy() {
    if (!newRawKey) return
    await navigator.clipboard.writeText(newRawKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-white rounded-xl border border-border p-6">
      <h2 className="font-medium text-ink mb-1">{t('title')}</h2>
      <p className="text-sm text-muted mb-4">
        {t('description')}
      </p>

      {demoMode && (
        <p className="text-xs text-muted border border-border rounded-lg px-3 py-2 bg-cream mb-4">
          {t('demoDisabled')}
        </p>
      )}

      {error && (
        <div className="mb-4 rounded-lg bg-cream border border-border px-4 py-3 text-sm text-red-500">
          {error}
        </div>
      )}

      {/* New raw key reveal — shown once immediately after creation */}
      {newRawKey && (
        <div className="mb-6 rounded-lg border border-accent/30 bg-accent/5 p-4">
          <p className="text-sm font-medium text-ink mb-2">
            {t('storeKey')}
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 block rounded bg-white border border-border px-3 py-2 text-sm font-mono text-ink break-all">
              {newRawKey}
            </code>
            <button
              type="button"
              onClick={() => void handleCopy()}
              className="shrink-0 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-ink hover:bg-cream transition-colors"
            >
              {copied ? tm('copied') : tm('copy')}
            </button>
          </div>
          <button
            type="button"
            onClick={() => setNewRawKey(null)}
            className="mt-3 text-xs text-muted underline hover:no-underline"
          >
            {t('dismiss')}
          </button>
        </div>
      )}

      {/* Create form */}
      {!demoMode && (
        <form onSubmit={(e) => void handleCreate(e)} className="flex gap-2 mb-6">
          <input
            type="text"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder={t('keyPlaceholder')}
            maxLength={100}
            className="flex-1 rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
            disabled={creating}
          />
          <button
            type="submit"
            disabled={creating || !newKeyName.trim()}
            className="rounded-lg bg-ink text-cream px-4 py-2 text-sm font-medium hover:bg-ink/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {creating ? tca('creating') : tc('create')}
          </button>
        </form>
      )}

      {/* Key list */}
      {loading ? (
        <p className="text-sm text-muted">{tc('loading')}</p>
      ) : keys.length === 0 ? (
        <p className="text-sm text-muted">{t('noKeys')}</p>
      ) : (
        <ul className="divide-y divide-border">
          {keys.map((key) => (
            <li key={key.id} className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium text-ink">{key.name}</p>
                <p className="text-xs text-muted mt-0.5">
                  {t('created')} {formatDate(key.createdAt)}
                  {' · '}
                  {t('lastUsed')} {formatDate(key.lastUsedAt)}
                </p>
              </div>
              {!demoMode && (
                <button
                  type="button"
                  disabled={deletingId === key.id}
                  onClick={() => void handleDelete(key.id, key.name)}
                  className="ms-4 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-cream disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {deletingId === key.id ? t('revoking') : t('revoke')}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
