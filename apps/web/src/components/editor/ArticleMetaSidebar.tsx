'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { SimpleTooltip as Tooltip } from '@/components/ui/simple-tooltip'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Globe, Lock } from 'lucide-react'

interface Collection {
  id: string
  title: string
  slug: string
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
  collectionSlug: string
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
  collectionSlug,
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
  const [navPath, setNavPath] = useState<{ id: string | null; title: string; emoji?: string | null }[]>([{ id: null, title: '', emoji: undefined }])
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const clickTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  useEffect(() => {
    const timers = clickTimers.current
    return () => {
      Object.values(timers).forEach(clearTimeout)
    }
  }, [])

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
    setNavPath([{ id: null, title: tCol('allCollections') }])
    setHighlightedId(hasPickedCollection ? collectionId : null)
  }

  function closeModal() {
    setCollectionOpen(false)
    setCollectionSearch('')
    setHighlightedId(null)
    setShowCreate(false)
    setNewTitle('')
    setNewDescription('')
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
      const created = await res.json() as { id: string; title: string; slug: string; emoji: string | null; isArchived: boolean }
      const parentDepth = viewingId ? (localCollections.find((c) => c.id === viewingId)?.depth ?? 0) : -1
      setLocalCollections((prev) => [...prev, {
        id: created.id,
        title: created.title,
        slug: created.slug,
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
    if (!item) return
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
      router.push('/articles')
      router.refresh()
    } catch {
      setDeleteError(tCommon('somethingWentWrong'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <aside className="w-72 bg-card border-s flex flex-col shrink-0 overflow-y-auto">
      <div className="p-5 border-b">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('articleSettings')}</p>
      </div>

      <div className="p-5 space-y-5 flex-1">
        {/* Status badge */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
            {t('status')}
          </label>
          <span className={`inline-flex items-center gap-1.5 text-sm px-2.5 py-1 rounded-full ${
            status === 'PUBLISHED'
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : status === 'ARCHIVED'
              ? 'bg-border text-muted-foreground'
              : 'bg-muted border text-muted-foreground'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              status === 'PUBLISHED' ? 'bg-emerald-500' : 'bg-muted-foreground'
            }`} />
            {status === 'PUBLISHED' ? tCommon('published') : status === 'ARCHIVED' ? tCommon('archived') : tCommon('draft')}
          </span>
        </div>

        {/* Collection */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
            {t('collection')}
          </label>
          {/* Trigger */}
          <Tooltip content={hasPickedCollection ? (selectedCollection?.title ?? '—') : tCol('selectCollection')} wrapperClassName="w-full">
            <Button
              type="button"
              variant="outline"
              onClick={openModal}
              className="w-full justify-start gap-2 h-auto px-3 py-2 text-sm font-normal"
            >
              {hasPickedCollection && <span className="shrink-0">{selectedCollection?.emoji ?? '📁'}</span>}
              <span className={`flex-1 text-left truncate ${!hasPickedCollection ? 'text-muted-foreground' : ''}`}>
                {hasPickedCollection
                  ? (selectedCollection?.title ?? '—')
                  : tCol('selectCollection')}
                {hasPickedCollection && selectedCollection?.isArchived && <span className="ml-1 text-muted-foreground">({tCommon('archived')})</span>}
              </span>
              <svg className="shrink-0 w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </Button>
          </Tooltip>

          {/* File explorer modal */}
          <Dialog open={collectionOpen} onOpenChange={(open) => { if (!open) closeModal() }}>
            <DialogContent
              className="relative flex max-h-[calc(100vh-2rem)] min-h-0 max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:max-h-[80vh]"
              style={{ height: 'min(560px, calc(100vh - 2rem))' }}
            >

              {/* Header */}
              <DialogHeader className="px-6 py-4 border-b shrink-0">
                <DialogTitle className="font-medium text-foreground">{tCol('moveToCollection')}</DialogTitle>
              </DialogHeader>

              {/* Toolbar: [←] breadcrumb ............... [search] */}
              <div className="flex items-center gap-3 px-6 py-3 border-b shrink-0">
                {/* Back button */}
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => navPath.length > 1 && navigateTo(navPath.length - 2)}
                  disabled={navPath.length <= 1}
                  className="shrink-0 w-7 h-7"
                  title={tCol('goBack')}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </Button>

                {/* Breadcrumb — fills available space */}
                {!searchResults && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground overflow-hidden flex-1 min-w-0">
                    {navPath.map((item, idx) => (
                      <span key={idx} className="flex items-center gap-1 shrink-0">
                        {idx > 0 && <span className="text-border mx-0.5">/</span>}
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => navigateTo(idx)}
                          title={item.emoji ? `${item.emoji} ${item.title}` : item.title}
                          className={`h-auto p-0 hover:bg-transparent hover:text-foreground transition-colors truncate max-w-[120px] ${idx === navPath.length - 1 ? 'text-foreground font-medium' : ''}`}
                        >
                          {item.emoji ? `${item.emoji} ${item.title}` : item.title}
                        </Button>
                      </span>
                    ))}
                  </div>
                )}
                {searchResults && <div className="flex-1" />}

                {/* Search — right side, fixed width */}
                <Input
                  type="text"
                  value={collectionSearch}
                  onChange={(e) => setCollectionSearch(e.target.value)}
                  placeholder={tCol('searchCollections')}
                  className="shrink-0 w-44 h-8 text-sm"
                />
              </div>

              {/* Content area */}
              <div className="min-h-0 flex-1 overflow-y-auto p-6">
                {searchResults ? (
                  searchResults.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                      <p className="text-4xl mb-2">🔍</p>
                      <p className="text-sm">{tCol('noCollectionsFound')}</p>
                    </div>
                  ) : (
                    <ul className="divide-y divide-border border rounded-xl overflow-hidden">
                      {searchResults.map((c) => {
                        const ancestorPath = getAncestorPath(c)
                        return (
                          <li key={c.id}>
                            <button
                              type="button"
                              onClick={() => { onCollectionChange(c.id); setHasPickedCollection(true); closeModal() }}
                              className={`w-full flex items-center gap-3 px-4 py-3 text-sm text-left hover:bg-muted transition-colors ${c.id === collectionId ? 'bg-primary/5' : ''}`}
                            >
                              <span className="text-xl shrink-0">{c.emoji ?? '📁'}</span>
                              <div className="flex-1 min-w-0">
                                <Tooltip content={c.title} wrapperClassName="w-full">
                                  <p className="truncate font-medium text-foreground">{c.title}</p>
                                </Tooltip>
                                {ancestorPath && (
                                  <Tooltip content={ancestorPath} wrapperClassName="w-full">
                                    <p className="text-xs text-muted-foreground truncate mt-0.5">{ancestorPath}</p>
                                  </Tooltip>
                                )}
                              </div>
                              {c.id === collectionId && (
                                <svg className="shrink-0 w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <p className="text-4xl mb-2">📭</p>
                    <p className="text-sm">{tCol('noSubCollections')}</p>
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
                          title={isFolder ? tCol('clickToSelectOrOpen') : tCol('clickToSelect')}
                          className={`relative flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all text-center select-none cursor-pointer
                            ${isHighlighted
                              ? 'border-primary bg-primary/10 shadow-sm'
                              : 'border-transparent hover:border-border hover:bg-muted'
                            }`}
                        >
                          {isCurrent && (
                            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary" title={tCol('currentCollection')} />
                          )}
                          <span className="text-4xl leading-none">{c.emoji ?? (isFolder ? '📁' : '📄')}</span>
                          <span className={`text-xs font-medium leading-tight line-clamp-2 w-full ${isHighlighted ? 'text-primary' : 'text-foreground'}`}>
                            {c.title}
                          </span>
                          {isFolder && (
                            <span className="text-[10px] text-muted-foreground/70">{tCol('doubleClickToOpen')}</span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Create form — shown inline when showCreate is true */}
              {showCreate && (
                <div className="absolute inset-0 z-10 flex min-h-0 flex-col overflow-hidden rounded-lg bg-background">
                  <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
                    <div>
                      <p className="font-medium text-foreground">{tCol('createCollection')}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {tCol('inCollection', { title: `${navPath.at(-1)?.emoji ? `${navPath.at(-1)?.emoji} ` : ''}${navPath.at(-1)?.title}` })}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => { setShowCreate(false); setCreateError('') }} className="h-7 w-7">
                      &#x2715;
                    </Button>
                  </div>
                  <form onSubmit={handleCreate} className="flex-1 space-y-4 overflow-y-auto p-6">
                    {/* Emoji */}
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">{tCol('icon')}</label>
                      <div className="flex flex-wrap gap-2">
                        {EMOJI_OPTIONS.map((e) => (
                          <Button key={e} type="button" variant={newEmoji === e ? 'default' : 'secondary'} size="icon" onClick={() => setNewEmoji(e)}
                            className="w-9 h-9 text-lg"
                          >{e}</Button>
                        ))}
                      </div>
                    </div>
                    {/* Title */}
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                        {tCol('title')} <span className="text-primary">*</span>
                      </label>
                      <Input
                        autoFocus
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        placeholder={tCol('placeholder')}
                        required
                      />
                    </div>
                    {/* Description */}
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">{tCol('description')}</label>
                      <Textarea
                        value={newDescription}
                        onChange={(e) => setNewDescription(e.target.value)}
                        placeholder={tCol('descriptionPlaceholder')}
                        rows={2}
                        className="resize-none"
                      />
                    </div>
                    {/* Visibility */}
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">{tCol('visibility')}</label>
                      <ToggleGroup
                        type="single"
                        value={newVisibility}
                        onValueChange={(v) => { if (v) setNewVisibility(v as 'PUBLIC' | 'INTERNAL') }}
                        className="justify-start"
                      >
                        <ToggleGroupItem value="PUBLIC" className="gap-2">
                          <Globe className="w-4 h-4" />
                          {tCol('visibilityPublic')}
                        </ToggleGroupItem>
                        <ToggleGroupItem value="INTERNAL" className="gap-2">
                          <Lock className="w-4 h-4" />
                          {tCol('visibilityInternal')}
                        </ToggleGroupItem>
                      </ToggleGroup>
                      <p className="text-xs text-muted-foreground mt-1.5">
                        {newVisibility === 'PUBLIC' ? tCol('visibilityPublicDescription') : tCol('visibilityInternalDescription')}
                      </p>
                    </div>
                    {createError && <p className="text-sm text-destructive">{createError}</p>}
                  </form>
                  <div className="flex items-center justify-end gap-3 px-6 py-4 border-t shrink-0">
                    <Button type="button" variant="ghost" onClick={() => { setShowCreate(false); setCreateError('') }}>
                      {tCommon('cancel')}
                    </Button>
                    <Button
                      type="button"
                      onClick={(e) => handleCreate(e as unknown as React.FormEvent)}
                      disabled={creating || !newTitle.trim()}
                    >
                      {creating ? tCol('creating') : viewingId ? tCol('createSubCollection') : tCol('createCollection')}
                    </Button>
                  </div>
                </div>
              )}

              {/* Footer — hidden when inline create form is showing */}
              <div className={`flex items-center justify-between px-6 py-4 border-t shrink-0 ${showCreate ? 'invisible' : ''}`}>
                {canCreateHere && !searchResults ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => { setShowCreate(true); setNewTitle(''); setNewDescription(''); setNewEmoji('📁'); setNewVisibility('PUBLIC'); setCreateError('') }}
                    className="text-xs text-muted-foreground hover:text-primary h-auto py-1"
                  >
                    {tCol('newCollection')}
                  </Button>
                ) : <span />}
                <div className="flex items-center gap-2">
                  <Button type="button" variant="ghost" onClick={closeModal}>
                    {tCommon('cancel')}
                  </Button>
                  <Button
                    type="button"
                    onClick={confirmSelection}
                    disabled={!highlightedId || highlightedId === collectionId}
                  >
                    {highlightedId && highlightedId !== collectionId ? tCol('moveHere') : tCol('select')}
                  </Button>
                </div>
              </div>

            </DialogContent>
          </Dialog>
        </div>

        {/* Slug */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
            {t('urlSlug')}
          </label>
          <Input
            value={slug}
            onChange={(e) => onSlugChange(sanitizeSlug(e.target.value))}
            onBlur={() => { if (!slug.trim()) onSlugChange(savedSlug) }}
            maxLength={200}
            className="font-mono"
          />
          {!slug.trim() && (
            <p className="text-xs text-destructive mt-1">{t('slugEmpty')}</p>
          )}
          <div className="flex items-center justify-between mt-1">
            <span className={`text-xs ${
              !slug.trim() ? 'text-destructive' :
              slug.length >= 180 ? 'text-destructive' :
              slug.length >= 150 ? 'text-amber-500' :
              'text-muted-foreground'
            }`}>
              {slug.length}/200
            </span>
            {slug !== savedSlug && (
              <Button
                variant="link"
                onClick={onSlugSave}
                disabled={!slug.trim()}
                className="text-xs h-auto p-0"
              >
                {t('saveSlug')}
              </Button>
            )}
          </div>
          <p
            className="text-xs text-muted-foreground mt-1 overflow-hidden text-ellipsis whitespace-nowrap"
            title={`help/${collectionSlug}/${slug}`}
          >
            help/{collectionSlug}/<strong>{slug}</strong>
          </p>
        </div>

        {/* Excerpt */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
            {t('excerpt')}
          </label>
          <Textarea
            value={excerpt}
            onChange={(e) => onExcerptChange(e.target.value)}
            placeholder={t('excerptPlaceholder')}
            rows={3}
            className="resize-none"
          />
        </div>
      </div>

      {/* Danger zone */}
      <div className="p-5 border-t">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { setDeleteError(''); setConfirmDelete(true) }}
          className="w-full text-xs text-muted-foreground hover:text-destructive h-auto py-1"
        >
          {t('deleteArticle')}
        </Button>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteConfirmTitle', { title: articleTitle })}</AlertDialogTitle>
            <AlertDialogDescription>{t('deleteConfirmMessage')}</AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && <p className="text-xs text-destructive px-1">{deleteError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmDelete(false)}>
              {tCommon('cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-500 text-white hover:bg-red-600 focus-visible:ring-red-500"
            >
              {deleting ? tCommon('deleting') : tCommon('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  )
}
