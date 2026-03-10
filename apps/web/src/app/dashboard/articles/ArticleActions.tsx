'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Props {
  articleId: string
  articleTitle: string
  articleStatus: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  demoMode?: boolean
}

export function ArticleActions({ articleId, articleTitle, articleStatus, demoMode = false }: Props) {
  const router = useRouter()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [error, setError] = useState('')

  async function handleArchive() {
    setArchiving(true)
    setError('')
    try {
      const newStatus = articleStatus === 'ARCHIVED' ? 'DRAFT' : 'ARCHIVED'
      const res = await fetch(`/api/articles/${articleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        setError(data.error ?? 'Something went wrong')
        return
      }
      router.refresh()
    } catch {
      setError('Something went wrong')
    } finally {
      setArchiving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    setError('')
    try {
      const res = await fetch(`/api/articles/${articleId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        setError(data.error ?? 'Something went wrong')
        return
      }
      setConfirmOpen(false)
      router.refresh()
    } catch {
      setError('Something went wrong')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <div className="flex items-center justify-end gap-3">
        <Link
          href={`/dashboard/articles/${articleId}/edit`}
          className="text-xs text-muted hover:text-accent transition-colors"
        >
          Edit
        </Link>
        <button
          onClick={handleArchive}
          disabled={archiving}
          className="text-xs text-muted hover:text-ink transition-colors disabled:opacity-50"
        >
          {archiving ? '…' : articleStatus === 'ARCHIVED' ? 'Unarchive' : 'Archive'}
        </button>
        {!demoMode && (
          <button
            onClick={() => { setError(''); setConfirmOpen(true) }}
            className="text-xs text-muted hover:text-red-500 transition-colors"
          >
            Delete
          </button>
        )}
      </div>

      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40"
          onClick={() => setConfirmOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h2 className="font-medium text-ink mb-2">Delete article?</h2>
              <p className="text-sm text-muted">
                <strong className="text-ink">&ldquo;{articleTitle}&rdquo;</strong> and all its version history will be permanently deleted.
              </p>
              {error && <p className="text-sm text-red-500 mt-3">{error}</p>}
              <div className="flex items-center justify-end gap-3 mt-6">
                <button
                  onClick={() => setConfirmOpen(false)}
                  className="px-4 py-2 text-sm text-muted hover:text-ink transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="bg-red-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-600 transition-colors font-medium disabled:opacity-50"
                >
                  {deleting ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
