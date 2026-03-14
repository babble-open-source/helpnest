'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Collection {
  id: string
  title: string
  emoji: string | null
  isArchived?: boolean
}

interface Props {
  articleId: string
  articleTitle: string
  slug: string
  onSlugChange: (v: string) => void
  excerpt: string
  onExcerptChange: (v: string) => void
  collectionId: string
  onCollectionChange: (v: string) => void
  status: string
  collections: Collection[]
}

export function ArticleMetaSidebar({
  articleId,
  articleTitle,
  slug,
  onSlugChange,
  excerpt,
  onExcerptChange,
  collectionId,
  onCollectionChange,
  status,
  collections,
}: Props) {
  const router = useRouter()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  async function handleDelete() {
    setDeleting(true)
    setDeleteError('')
    try {
      const res = await fetch(`/api/articles/${articleId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        setDeleteError(data.error ?? 'Something went wrong')
        return
      }
      router.push('/dashboard/articles')
      router.refresh()
    } catch {
      setDeleteError('Something went wrong')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <aside className="w-72 bg-white border-l border-border flex flex-col shrink-0 overflow-y-auto">
      <div className="p-5 border-b border-border">
        <p className="text-xs font-medium text-muted uppercase tracking-wide">Article settings</p>
      </div>

      <div className="p-5 space-y-5 flex-1">
        {/* Status badge */}
        <div>
          <label className="block text-xs font-medium text-muted uppercase tracking-wide mb-1.5">
            Status
          </label>
          <span className={`inline-flex items-center gap-1.5 text-sm px-2.5 py-1 rounded-full ${
            status === 'PUBLISHED'
              ? 'bg-green/10 text-green'
              : status === 'ARCHIVED'
              ? 'bg-border text-muted'
              : 'bg-cream border border-border text-muted'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              status === 'PUBLISHED' ? 'bg-green' : 'bg-muted'
            }`} />
            {status.charAt(0) + status.slice(1).toLowerCase()}
          </span>
        </div>

        {/* Collection */}
        <div>
          <label className="block text-xs font-medium text-muted uppercase tracking-wide mb-1.5">
            Collection
          </label>
          <div className="relative">
          <select
            value={collectionId}
            onChange={(e) => onCollectionChange(e.target.value)}
            className="w-full appearance-none px-3 py-2 pr-8 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent bg-white text-ink cursor-pointer"
          >
            {collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.emoji} {c.title}{c.isArchived ? ' (archived)' : ''}
              </option>
            ))}
          </select>
          <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          </div>
        </div>

        {/* Slug */}
        <div>
          <label className="block text-xs font-medium text-muted uppercase tracking-wide mb-1.5">
            URL slug
          </label>
          <input
            value={slug}
            onChange={(e) => onSlugChange(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent font-mono"
          />
          <p className="text-xs text-muted mt-1">
            help/collection/<strong>{slug}</strong>
          </p>
        </div>

        {/* Excerpt */}
        <div>
          <label className="block text-xs font-medium text-muted uppercase tracking-wide mb-1.5">
            Excerpt
          </label>
          <textarea
            value={excerpt}
            onChange={(e) => onExcerptChange(e.target.value)}
            placeholder="Brief summary shown in article lists..."
            rows={3}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent resize-none"
          />
        </div>
      </div>

      {/* Danger zone */}
      <div className="p-5 border-t border-border">
        {!confirmDelete ? (
          <button
            onClick={() => { setDeleteError(''); setConfirmDelete(true) }}
            className="w-full text-xs text-muted hover:text-red-500 transition-colors py-1"
          >
            Delete article
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-ink font-medium">Delete &ldquo;{articleTitle}&rdquo;?</p>
            <p className="text-xs text-muted">This cannot be undone. All version history will also be deleted.</p>
            {deleteError && <p className="text-xs text-red-500">{deleteError}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 text-xs text-muted hover:text-ink transition-colors py-1.5 border border-border rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 text-xs bg-red-500 text-white rounded-lg py-1.5 hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
