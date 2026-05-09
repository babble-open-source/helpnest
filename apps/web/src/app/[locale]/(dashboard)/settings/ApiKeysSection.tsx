'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations, useFormatter } from 'next-intl'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

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
  const [keyToDelete, setKeyToDelete] = useState<{ id: string; name: string } | null>(null)

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

  async function handleDelete(id: string) {
    setKeyToDelete(null)
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
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent>
        {demoMode && (
          <p className="text-xs text-muted-foreground border rounded-lg px-3 py-2 bg-muted mb-4">
            {t('demoDisabled')}
          </p>
        )}

        {error && (
          <div className="mb-4 rounded-lg bg-muted border px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* New raw key reveal — shown once immediately after creation */}
        {newRawKey && (
          <div className="mb-6 rounded-lg border border-primary/30 bg-primary/5 p-4">
            <p className="text-sm font-medium text-foreground mb-2">{t('storeKey')}</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 block rounded bg-card border px-3 py-2 text-sm font-mono text-foreground break-all">
                {newRawKey}
              </code>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleCopy()}
                className="shrink-0"
              >
                {copied ? tm('copied') : tm('copy')}
              </Button>
            </div>
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={() => setNewRawKey(null)}
              className="mt-3 h-auto p-0 text-xs text-muted-foreground"
            >
              {t('dismiss')}
            </Button>
          </div>
        )}

        {/* Create form */}
        {!demoMode && (
          <form onSubmit={(e) => void handleCreate(e)} className="flex gap-2 mb-6">
            <Input
              type="text"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder={t('keyPlaceholder')}
              maxLength={100}
              className="flex-1"
              disabled={creating}
            />
            <Button
              type="submit"
              disabled={creating || !newKeyName.trim()}
            >
              {creating ? tca('creating') : tc('create')}
            </Button>
          </form>
        )}

        {/* Key list */}
        {loading ? (
          <p className="text-sm text-muted-foreground">{tc('loading')}</p>
        ) : keys.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('noKeys')}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>{t('created')}</TableHead>
                <TableHead>{t('lastUsed')}</TableHead>
                {!demoMode && <TableHead className="w-[80px]" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map((key) => (
                <TableRow key={key.id}>
                  <TableCell className="font-medium text-foreground">{key.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(key.createdAt)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(key.lastUsedAt)}</TableCell>
                  {!demoMode && (
                    <TableCell>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={deletingId === key.id}
                        onClick={() => setKeyToDelete({ id: key.id, name: key.name })}
                        className="border-destructive/40 text-destructive hover:bg-destructive/10"
                      >
                        {deletingId === key.id ? t('revoking') : t('revoke')}
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <ConfirmDialog
          open={!!keyToDelete}
          title={t('revoke')}
          message={keyToDelete ? t('confirmDelete', { name: keyToDelete.name }) : ''}
          confirmLabel={t('revoke')}
          cancelLabel={tc('cancel')}
          destructive
          onConfirm={() => { if (keyToDelete) void handleDelete(keyToDelete.id) }}
          onCancel={() => setKeyToDelete(null)}
        />
      </CardContent>
    </Card>
  )
}
