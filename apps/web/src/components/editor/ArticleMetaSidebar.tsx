'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { Tooltip } from '@/components/ui/Tooltip'

interface Collection {
  id: string
  title: string
  emoji: string | null
  isArchived?: boolean
  depth?: number
  parentId?: string | null
}

function sanitizeSlug(val: string): string {
  return val.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 200)
}

interface Props {
  articleId: string
  articleTitle: string
  slug: string
  savedSlug: string
  onSlugChange: (v: string) => void
  onSlugSave: () => void
  excerpt: string
  onExcerptChange: (v: string) => void
  collectionId: string
  onCollectionChange: (v: string) => void
  status: string
  collections: Collection[]
  autoOpenPicker?: boolean
}

export function ArticleMetaSidebar({
  articleId,
  articleTitle,
  slug,
  savedSlug,
  onSlugChange,
  onSlugSave,
  excerpt,
  onExcerptChange,
  collectionId,
  onCollectionChange,
  status,
  collections,
  autoOpenPicker,
}: Props) {
  const router = useRouter()
  const t = useTranslations('articleMeta')
  const tCommon = useTranslations('common')
  const tCol = useTranslations('collectionsActions')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [localCollections, setLocalCollections] = useState(collections)
  const [collectionOpen, setCollectionOpen] = useState(false)
  const [collectionSearch, setCollectionSearch] = useState('')
  const [viewingId, setViewingId] = useState<string | null>(null)
  const [navPath, setNavPath] = useState<{ id: string | null; title: string; emoji?: string | null }[]>([{ id: null, title: 'All Collections' }])
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const clickTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  // Create form state
  const EMOJI_OPTIONS = ['📁', '📄', '🚀', '⚡', '🛠️', '💡', '🎯', '📚', '🔧', '✨', '🌟', '🔑']
  const [showCreate, setShowCreate] = useState(false)
  const [newEmoji, setNewEmoji] = useState('📁')
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newVisibility, setNewVisibility] = useState<'PUBLIC' | 'INTERNAL'>('PUBLIC')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  const selectedCollection = localCollections.find((c) => c.id === collectionId)

  const [hasPickedCollection, setHasPickedCollection] = useState(!autoOpenPicker)

  function openModal() {
    setCollectionOpen(true)
    setCollectionSearch('')
    setViewingId(null)
    setNavPath([{ id: null, title: 'All Collections' }])
    setHighlightedId(hasPickedCollection ? collectionId : null)
  }

  function closeModal() {
    setCollectionOpen(false)
    setCollectionSearch('')
    setHighlightedId(null)
    setShowCreate(false)
    setNewTitle('')
    setNewEmoji('📁')
    setCreateError('')
  }

  function hasChildren(id: string) {
    return localCollections.some((c) => c.parentId === id)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle.trim()) return
    setCreating(true)
    setCreateError('')
    try {
      const res = await fetch('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDescription.trim(),
          emoji: newEmoji,
          visibility: newVisibility,
          ...(viewingId ? { parentId: viewingId } : {}),
        }),
      })
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        setCreateError(data.error ?? tCommon('somethingWentWrong'))
        return
      }
      const created = await res.json() as { id: string; title: string; emoji: string | null; isArchived: boolean }
      const parentDepth = viewingId ? (localCollections.find((c) => c.id === viewingId)?.depth ?? 0) : -1
      setLocalCollections((prev) => [...prev, {
        id: created.id,
        title: created.title,
        emoji: created.emoji,
        isArchived: created.isArchived,
        depth: parentDepth + 1,
        parentId: viewingId,
      }])
      setShowCreate(false)
      setNewTitle('')
      setNewDescription('')
      setNewEmoji('📁')
      setNewVisibility('PUBLIC')
      setCreateError('')
    } catch {
      setCreateError(tCommon('somethingWentWrong'))
    } finally {
      setCreating(false)
    }
  }

  function navigateInto(c: Collection) {
    setViewingId(c.id)
    setNavPath((prev) => [...prev, { id: c.id, title: c.title, emoji: c.emoji }])
    setHighlightedId(c.id)
    setCollectionSearch('')
  }

  function navigateTo(idx: number) {
    const item = navPath[idx]
    setNavPath(navPath.slice(0, idx + 1))
    setViewingId(item.id)
    setHighlightedId(item.id)
    setCollectionSearch('')
  }

  function handleTileClick(c: Collection) {
    // Single click: highlight the tile
    setHighlightedId(c.id)
    // Double click detection
    if (clickTimers.current[c.id]) {
      clearTimeout(clickTimers.current[c.id])
      delete clickTimers.current[c.id]
      // Double click: navigate in if has children, else select
      if (hasChildren(c.id)) {
        navigateInto(c)
      } else {
        onCollectionChange(c.id)
        setHasPickedCollection(true)
        closeModal()
      }
    } else {
      clickTimers.current[c.id] = setTimeout(() => {
        delete clickTimers.current[c.id]
      }, 300)
    }
  }

  function getAncestorPath(c: Collection): string {
    const parts: string[] = []
    let current = localCollections.find((x) => x.id === c.parentId)
    while (current) {
      parts.unshift(`${current.emoji ?? '📁'} ${current.title}`)
      current = localCollections.find((x) => x.id === current!.parentId)
    }
    return parts.join(' / ')
  }

  function confirmSelection() {
    if (highlightedId) {
      onCollectionChange(highlightedId)
      setHasPickedCollection(true)
      closeModal()
    }
  }

  const currentItems = localCollections.filter((c) => (c.parentId ?? null) === viewingId)
  const searchResults = collectionSearch.trim()
    ? localCollections.filter((c) => c.title.toLowerCase().includes(collectionSearch.toLowerCase()))
    : null
  const viewingDepth = viewingId ? (localCollections.find((c) => c.id === viewingId)?.depth ?? 0) : -1
  const canCreateHere = viewingDepth < 2

  async function handleDelete() {
    setDeleting(true)
    setDeleteError('')
    try {
      const res = await fetch(`/api/articles/${articleId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        setDeleteError(data.error ?? tCommon('somethingWentWrong'))
        return
      }
      router.push('/dashboard/articles')
      router.refresh()
    } catch {
      setDeleteError(tCommon('somethingWentWrong'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <aside className="w-72 bg-white border-s border-border flex flex-col shrink-0 overflow-y-auto">
      <div className="p-5 border-b border-border">
        <p className="text-xs font-medium text-muted uppercase tracking-wide">{t('articleSettings')}</p>
      </div>

      <div className="p-5 space-y-5 flex-1">
        {/* Status badge */}
        <div>
          <label className="block text-xs font-medium text-muted uppercase tracking-wide mb-1.5">
            {t('status')}
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
            {status === 'PUBLISHED' ? tCommon('published') : status === 'ARCHIVED' ? tCommon('archived') : tCommon('draft')}
          </span>
        </div>

        {/* Collection */}
        <div>
          <label className="block text-xs font-medium text-muted uppercase tracking-wide mb-1.5">
            {t('collection')}
          </label>
          {/* Trigger */}
          <Tooltip content={hasPickedCollection ? (selectedCollection?.title ?? '—') : 'Select a collection'} wrapperClassName="w-full">
            <button
              type="button"
              onClick={openModal}
              className="w-full flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm bg-white text-ink hover:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent transition-colors"
            >
              {hasPickedCollection && <span className="shrink-0">{selectedCollection?.emoji ?? '📁'}</span>}
              <span className={`flex-1 text-left truncate ${!hasPickedCollection ? 'text-muted' : ''}`}>
                {hasPickedCollection
                  ? (selectedCollection?.title ?? '—')
                  : 'Select a collection'}
                {hasPickedCollection && selectedCollection?.isArchived && <span className="ml-1 text-muted">({tCommon('archived')})</span>}
              </span>
              <svg className="shrink-0 w-4 h-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          </Tooltip>

          {/* File explorer modal */}
          {collectionOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={closeModal}>
              <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden" style={{ height: '560px' }} onClick={(e) => e.stopPropagation()}>

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
                  <p className="font-medium text-ink">Move to collection</p>
                  <button onClick={closeModal} className="text-muted hover:text-ink transition-colors text-lg leading-none">&#x2715;</button>
                </div>

                {/* Toolbar: [←] breadcrumb ............... [search] */}
                <div className="flex items-center gap-3 px-6 py-3 border-b border-border shrink-0">
                  {/* Back button */}
                  <button
                    type="button"
                    onClick={() => navPath.length > 1 && navigateTo(navPath.length - 2)}
                    disabled={navPath.length <= 1}
                    className="shrink-0 flex items-center justify-center w-7 h-7 rounded-lg border border-border text-muted hover:text-ink hover:border-ink/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Go back"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>

                  {/* Breadcrumb — fills available space */}
                  {!searchResults && (
                    <div className="flex items-center gap-1 text-xs text-muted overflow-hidden flex-1 min-w-0">
                      {navPath.map((item, idx) => (
                        <span key={idx} className="flex items-center gap-1 shrink-0">
                          {idx > 0 && <span className="text-border mx-0.5">/</span>}
                          <Tooltip content={item.emoji ? `${item.emoji} ${item.title}` : item.title} side="bottom">
                            <button
                              type="button"
                              onClick={() => navigateTo(idx)}
                              className={`hover:text-ink transition-colors truncate max-w-[120px] ${idx === navPath.length - 1 ? 'text-ink font-medium' : ''}`}
                            >
                              {item.emoji ? `${item.emoji} ${item.title}` : item.title}
                            </button>
                          </Tooltip>
                        </span>
                      ))}
                    </div>
                  )}
                  {searchResults && <div className="flex-1" />}

                  {/* Search — right side, fixed width */}
                  <input
                    type="text"
                    value={collectionSearch}
                    onChange={(e) => setCollectionSearch(e.target.value)}
                    placeholder="Search..."
                    className="shrink-0 w-44 px-3 py-1.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent bg-white text-ink placeholder:text-muted"
                  />
                </div>

                {/* Content area */}
                <div className="flex-1 overflow-y-auto p-6">
                  {searchResults ? (
                    searchResults.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-muted">
                        <p className="text-4xl mb-2">🔍</p>
                        <p className="text-sm">No collections found</p>
                      </div>
                    ) : (
                      <ul className="divide-y divide-border border border-border rounded-xl overflow-hidden">
                        {searchResults.map((c) => {
                          const ancestorPath = getAncestorPath(c)
                          return (
                            <li key={c.id}>
                              <button
                                type="button"
                                onClick={() => { onCollectionChange(c.id); setHasPickedCollection(true); closeModal() }}
                                className={`w-full flex items-center gap-3 px-4 py-3 text-sm text-left hover:bg-cream transition-colors ${c.id === collectionId ? 'bg-accent/5' : ''}`}
                              >
                                <span className="text-xl shrink-0">{c.emoji ?? '📁'}</span>
                                <div className="flex-1 min-w-0">
                                  <Tooltip content={c.title} wrapperClassName="w-full">
                                    <p className="truncate font-medium text-ink">{c.title}</p>
                                  </Tooltip>
                                  {ancestorPath && (
                                    <Tooltip content={ancestorPath} wrapperClassName="w-full">
                                      <p className="text-xs text-muted truncate mt-0.5">{ancestorPath}</p>
                                    </Tooltip>
                                  )}
                                </div>
                                {c.id === collectionId && (
                                  <svg className="shrink-0 w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    )
                  ) : currentItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted">
                      <p className="text-4xl mb-2">📭</p>
                      <p className="text-sm">No sub-collections here</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-3">
                      {currentItems.map((c) => {
                        const isFolder = hasChildren(c.id)
                        const isHighlighted = highlightedId === c.id
                        const isCurrent = c.id === collectionId
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => handleTileClick(c)}
                            title={isFolder ? 'Click to select · Double-click to open' : 'Click to select'}
                            className={`relative flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all text-center select-none cursor-pointer
                              ${isHighlighted
                                ? 'border-accent bg-accent/10 shadow-sm'
                                : 'border-transparent hover:border-border hover:bg-cream'
                              }`}
                          >
                            {isCurrent && (
                              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-accent" title="Current collection" />
                            )}
                            <span className="text-4xl leading-none">{c.emoji ?? (isFolder ? '📁' : '📄')}</span>
                            <span className={`text-xs font-medium leading-tight line-clamp-2 w-full ${isHighlighted ? 'text-accent' : 'text-ink'}`}>
                              {c.title}
                            </span>
                            {isFolder && (
                              <span className="text-[10px] text-muted/70">double-click to open</span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Create form — shown inline when showCreate is true */}
                {showCreate && (
                  <div className="absolute inset-0 bg-white rounded-2xl flex flex-col overflow-hidden">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
                      <div>
                        <p className="font-medium text-ink">New collection</p>
                        <p className="text-xs text-muted mt-0.5">
                          in {navPath[navPath.length - 1].emoji ? `${navPath[navPath.length - 1].emoji} ` : ''}{navPath[navPath.length - 1].title}
                        </p>
                      </div>
                      <button onClick={() => { setShowCreate(false); setCreateError('') }} className="text-muted hover:text-ink transition-colors text-lg leading-none">&#x2715;</button>
                    </div>
                    <form onSubmit={handleCreate} className="p-6 space-y-4 flex-1 overflow-y-auto">
                      {/* Emoji */}
                      <div>
                        <label className="block text-xs font-medium text-muted uppercase tracking-wide mb-2">{tCol('icon')}</label>
                        <div className="flex flex-wrap gap-2">
                          {EMOJI_OPTIONS.map((e) => (
                            <button key={e} type="button" onClick={() => setNewEmoji(e)}
                              className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-colors ${newEmoji === e ? 'bg-ink text-cream' : 'bg-cream hover:bg-border'}`}
                            >{e}</button>
                          ))}
                        </div>
                      </div>
                      {/* Title */}
                      <div>
                        <label className="block text-xs font-medium text-muted uppercase tracking-wide mb-1.5">
                          {tCol('title')} <span className="text-accent">*</span>
                        </label>
                        <input
                          autoFocus
                          value={newTitle}
                          onChange={(e) => setNewTitle(e.target.value)}
                          placeholder={tCol('placeholder')}
                          required
                          className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent bg-white text-ink"
                        />
                      </div>
                      {/* Description */}
                      <div>
                        <label className="block text-xs font-medium text-muted uppercase tracking-wide mb-1.5">{tCol('description')}</label>
                        <textarea
                          value={newDescription}
                          onChange={(e) => setNewDescription(e.target.value)}
                          placeholder={tCol('descriptionPlaceholder')}
                          rows={2}
                          className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-none bg-white text-ink"
                        />
                      </div>
                      {/* Visibility */}
                      <div>
                        <label className="block text-xs font-medium text-muted uppercase tracking-wide mb-2">{tCol('visibility')}</label>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => setNewVisibility('PUBLIC')}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-colors ${newVisibility === 'PUBLIC' ? 'border-accent bg-accent/5 text-ink' : 'border-border text-muted hover:border-ink'}`}
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            {tCol('visibilityPublic')}
                          </button>
                          <button type="button" onClick={() => setNewVisibility('INTERNAL')}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-colors ${newVisibility === 'INTERNAL' ? 'border-accent bg-accent/5 text-ink' : 'border-border text-muted hover:border-ink'}`}
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                            {tCol('visibilityInternal')}
                          </button>
                        </div>
                        <p className="text-xs text-muted mt-1.5">
                          {newVisibility === 'PUBLIC' ? tCol('visibilityPublicDescription') : tCol('visibilityInternalDescription')}
                        </p>
                      </div>
                      {createError && <p className="text-sm text-red-500">{createError}</p>}
                    </form>
                    <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border shrink-0">
                      <button type="button" onClick={() => { setShowCreate(false); setCreateError('') }} className="px-4 py-2 text-sm text-muted hover:text-ink transition-colors">
                        {tCommon('cancel')}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleCreate(e as unknown as React.FormEvent)}
                        disabled={creating || !newTitle.trim()}
                        className="bg-ink text-cream px-4 py-2 rounded-lg text-sm hover:bg-ink/90 transition-colors font-medium disabled:opacity-50"
                      >
                        {creating ? tCol('creating') : viewingId ? tCol('createSubCollection') : tCol('createCollection')}
                      </button>
                    </div>
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-border shrink-0">
                  {canCreateHere && !searchResults ? (
                    <button
                      type="button"
                      onClick={() => { setShowCreate(true); setNewTitle(''); setNewDescription(''); setNewEmoji('📁'); setNewVisibility('PUBLIC'); setCreateError('') }}
                      className="text-xs text-muted hover:text-accent transition-colors"
                    >
                      + New collection
                    </button>
                  ) : <span />}
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={closeModal} className="px-4 py-2 text-sm text-muted hover:text-ink transition-colors">
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={confirmSelection}
                      disabled={!highlightedId || highlightedId === collectionId}
                      className="px-4 py-2 text-sm bg-ink text-cream rounded-lg hover:bg-ink/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed font-medium"
                    >
                      {highlightedId && highlightedId !== collectionId ? 'Move here' : 'Select'}
                    </button>
                  </div>
                </div>

              </div>
            </div>
          )}
        </div>

        {/* Slug */}
        <div>
          <label className="block text-xs font-medium text-muted uppercase tracking-wide mb-1.5">
            {t('urlSlug')}
          </label>
          <input
            value={slug}
            onChange={(e) => onSlugChange(sanitizeSlug(e.target.value))}
            onBlur={() => { if (!slug.trim()) onSlugChange(savedSlug) }}
            maxLength={200}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent font-mono"
          />
          {!slug.trim() && (
            <p className="text-xs text-red-500 mt-1">{t('slugEmpty')}</p>
          )}
          <div className="flex items-center justify-between mt-1">
            <span className={`text-xs ${
              !slug.trim() ? 'text-red-500' :
              slug.length >= 180 ? 'text-red-500' :
              slug.length >= 150 ? 'text-amber-500' :
              'text-muted'
            }`}>
              {slug.length}/200
            </span>
            {slug !== savedSlug && (
              <button
                onClick={onSlugSave}
                disabled={!slug.trim()}
                className="text-xs text-accent hover:underline font-medium cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t('saveSlug')}
              </button>
            )}
          </div>
          <p
            className="text-xs text-muted mt-1 overflow-hidden text-ellipsis whitespace-nowrap"
            title={`${t('helpCollectionPath')}/${slug}`}
          >
            {t('helpCollectionPath')}/<strong>{slug}</strong>
          </p>
        </div>

        {/* Excerpt */}
        <div>
          <label className="block text-xs font-medium text-muted uppercase tracking-wide mb-1.5">
            {t('excerpt')}
          </label>
          <textarea
            value={excerpt}
            onChange={(e) => onExcerptChange(e.target.value)}
            placeholder={t('excerptPlaceholder')}
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
            {t('deleteArticle')}
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-ink font-medium">{t('deleteConfirmTitle', { title: articleTitle })}</p>
            <p className="text-xs text-muted">{t('deleteConfirmMessage')}</p>
            {deleteError && <p className="text-xs text-red-500">{deleteError}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 text-xs text-muted hover:text-ink transition-colors py-1.5 border border-border rounded-lg"
              >
                {tCommon('cancel')}
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 text-xs bg-red-500 text-white rounded-lg py-1.5 hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {deleting ? tCommon('deleting') : tCommon('delete')}
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
