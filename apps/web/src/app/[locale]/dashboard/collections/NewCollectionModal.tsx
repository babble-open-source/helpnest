'use client'

import { useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'

const EMOJI_OPTIONS = ['📁', '📄', '🚀', '⚡', '🛠️', '💡', '🎯', '📚', '🔧', '✨', '🌟', '🔑']

interface Props {
  parentId?: string
  parentTitle?: string
}

export function NewCollectionModal({ parentId, parentTitle }: Props = {}) {
  const router = useRouter()
  const t = useTranslations('collectionsActions')
  const tc = useTranslations('common')
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [emoji, setEmoji] = useState('📁')
  const [visibility, setVisibility] = useState<'PUBLIC' | 'INTERNAL'>('PUBLIC')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isSubCollection = !!parentId

  function reset() {
    setTitle('')
    setDescription('')
    setEmoji('📁')
    setVisibility('PUBLIC')
    setError('')
  }

  function close() {
    reset()
    setOpen(false)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          emoji,
          visibility,
          ...(parentId ? { parentId } : {}),
        }),
      })
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        setError(data.error ?? tc('somethingWentWrong'))
        return
      }
      close()
      router.refresh()
    } catch {
      setError(tc('somethingWentWrong'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {isSubCollection ? (
        <button
          onClick={() => setOpen(true)}
          className="bg-ink text-cream px-3 sm:px-4 py-2 rounded-lg text-sm hover:bg-ink/90 transition-colors font-medium"
        >
          {t('newSubCollection')}
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="bg-ink text-cream px-4 py-2 rounded-lg text-sm hover:bg-ink/90 transition-colors font-medium"
        >
          {t('newCollection')}
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40"
          onClick={close}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <h2 className="font-medium text-ink">
                  {isSubCollection ? t('createSubCollection') : t('createCollection')}
                </h2>
                {isSubCollection && parentTitle && (
                  <p className="text-xs text-muted mt-0.5">{t('inCollection', { title: parentTitle })}</p>
                )}
              </div>
              <button onClick={close} className="text-muted hover:text-ink transition-colors">
                &#x2715;
              </button>
            </div>

            <form onSubmit={submit} className="p-6 space-y-4">
              {/* Emoji picker */}
              <div>
                <label className="block text-xs font-medium text-muted uppercase tracking-wide mb-2">
                  {t('icon')}
                </label>
                <div className="flex flex-wrap gap-2">
                  {EMOJI_OPTIONS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setEmoji(e)}
                      className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-colors ${
                        emoji === e
                          ? 'bg-ink text-cream'
                          : 'bg-cream hover:bg-border'
                      }`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-medium text-muted uppercase tracking-wide mb-1.5">
                  {t('title')} <span className="text-accent">*</span>
                </label>
                <input
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t('placeholder')}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent bg-white text-ink"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-muted uppercase tracking-wide mb-1.5">
                  {t('description')}
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('descriptionPlaceholder')}
                  rows={2}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-none bg-white text-ink"
                />
              </div>

              {/* Visibility */}
              <div>
                <label className="block text-xs font-medium text-muted uppercase tracking-wide mb-2">
                  {t('visibility')}
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setVisibility('PUBLIC')}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-colors ${
                      visibility === 'PUBLIC'
                        ? 'border-accent bg-accent/5 text-ink'
                        : 'border-border text-muted hover:border-ink'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    {t('visibilityPublic')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setVisibility('INTERNAL')}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-colors ${
                      visibility === 'INTERNAL'
                        ? 'border-accent bg-accent/5 text-ink'
                        : 'border-border text-muted hover:border-ink'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    {t('visibilityInternal')}
                  </button>
                </div>
                <p className="text-xs text-muted mt-1.5">
                  {visibility === 'PUBLIC'
                    ? t('visibilityPublicDescription')
                    : t('visibilityInternalDescription')}
                </p>
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={close}
                  className="px-4 py-2 text-sm text-muted hover:text-ink transition-colors"
                >
                  {tc('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={saving || !title.trim()}
                  className="bg-ink text-cream px-4 py-2 rounded-lg text-sm hover:bg-ink/90 transition-colors font-medium disabled:opacity-50"
                >
                  {saving ? t('creating') : isSubCollection ? t('createSubCollection') : t('createCollection')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
