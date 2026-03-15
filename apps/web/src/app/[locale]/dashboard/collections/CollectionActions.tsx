'use client'

import { useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'

const EMOJI_OPTIONS = ['📁', '📄', '🚀', '⚡', '🛠️', '💡', '🎯', '📚', '🔧', '✨', '🌟', '🔑']

interface Props {
  collection: {
    id: string
    title: string
    description: string | null
    emoji: string | null
    articleCount: number
    isArchived: boolean
  }
  demoMode?: boolean
}

export function CollectionActions({ collection, demoMode = false }: Props) {
  const router = useRouter()
  const t = useTranslations('collectionsActions')
  const tc = useTranslations('common')

  // Edit state
  const [editOpen, setEditOpen] = useState(false)
  const [title, setTitle] = useState(collection.title)
  const [description, setDescription] = useState(collection.description ?? '')
  const [emoji, setEmoji] = useState(collection.emoji ?? '📁')
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState('')

  // Delete state
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [archiving, setArchiving] = useState(false)
  const [archiveError, setArchiveError] = useState('')

  function openEdit() {
    setTitle(collection.title)
    setDescription(collection.description ?? '')
    setEmoji(collection.emoji ?? '📁')
    setEditError('')
    setEditOpen(true)
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    setEditError('')
    try {
      const res = await fetch(`/api/collections/${collection.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), description: description.trim(), emoji }),
      })
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        setEditError(data.error ?? tc('somethingWentWrong'))
        return
      }
      setEditOpen(false)
      router.refresh()
    } catch {
      setEditError(tc('somethingWentWrong'))
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    setDeleting(true)
    setDeleteError('')
    try {
      const res = await fetch(`/api/collections/${collection.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        setDeleteError(data.error ?? tc('somethingWentWrong'))
        return
      }
      setDeleteOpen(false)
      router.refresh()
    } catch {
      setDeleteError(tc('somethingWentWrong'))
    } finally {
      setDeleting(false)
    }
  }

  async function handleArchive() {
    setArchiving(true)
    setArchiveError('')
    try {
      const res = await fetch(`/api/collections/${collection.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isArchived: !collection.isArchived }),
      })
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        setArchiveError(data.error ?? tc('somethingWentWrong'))
        return
      }
      router.refresh()
    } catch {
      setArchiveError(tc('somethingWentWrong'))
    } finally {
      setArchiving(false)
    }
  }

  return (
    <>
      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-3">
          <button
            onClick={openEdit}
            className="text-xs text-muted hover:text-accent transition-colors"
          >
            {t('edit')}
          </button>
          <button
            onClick={handleArchive}
            disabled={archiving}
            className="text-xs text-muted hover:text-ink transition-colors disabled:opacity-50"
          >
            {archiving ? '…' : collection.isArchived ? t('unarchive') : tc('archive')}
          </button>
          {!demoMode && (
            <button
              onClick={() => { setDeleteError(''); setDeleteOpen(true) }}
              className="text-xs text-muted hover:text-red-500 transition-colors"
            >
              {tc('delete')}
            </button>
          )}
        </div>
        {archiveError && <p className="text-xs text-red-500">{archiveError}</p>}
      </div>

      {/* Edit modal */}
      {editOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40"
          onClick={() => setEditOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="font-medium text-ink">{t('editCollection')}</h2>
              <button onClick={() => setEditOpen(false)} className="text-muted hover:text-ink transition-colors">
                &#x2715;
              </button>
            </div>
            <form onSubmit={saveEdit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted uppercase tracking-wide mb-2">{t('icon')}</label>
                <div className="flex flex-wrap gap-2">
                  {EMOJI_OPTIONS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setEmoji(e)}
                      className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-colors ${
                        emoji === e ? 'bg-ink text-cream' : 'bg-cream hover:bg-border'
                      }`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted uppercase tracking-wide mb-1.5">
                  {t('title')} <span className="text-accent">*</span>
                </label>
                <input
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent bg-white text-ink"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted uppercase tracking-wide mb-1.5">{t('description')}</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-none bg-white text-ink"
                />
              </div>
              {editError && <p className="text-sm text-red-500">{editError}</p>}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={() => setEditOpen(false)} className="px-4 py-2 text-sm text-muted hover:text-ink transition-colors">
                  {tc('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={saving || !title.trim()}
                  className="bg-ink text-cream px-4 py-2 rounded-lg text-sm hover:bg-ink/90 transition-colors font-medium disabled:opacity-50"
                >
                  {saving ? tc('saving') : t('saveChanges')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40"
          onClick={() => setDeleteOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h2 className="font-medium text-ink mb-2">{t('deleteCollection')}</h2>
              <p className="text-sm text-muted">
                <strong className="text-ink">{collection.title}</strong>{t('willBeDeleted')}
                {collection.articleCount > 0 && (
                  <span className="block mt-1 text-red-500">
                    {t('hasArticles', { count: collection.articleCount })}
                  </span>
                )}
              </p>
              {deleteError && <p className="text-sm text-red-500 mt-3">{deleteError}</p>}
              <div className="flex items-center justify-end gap-3 mt-6">
                <button
                  onClick={() => setDeleteOpen(false)}
                  className="px-4 py-2 text-sm text-muted hover:text-ink transition-colors"
                >
                  {tc('cancel')}
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={deleting || collection.articleCount > 0}
                  className="bg-red-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-600 transition-colors font-medium disabled:opacity-50"
                >
                  {deleting ? tc('deleting') : tc('delete')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
