'use client'

import { useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Globe, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'

const EMOJI_OPTIONS = ['📁', '📄', '🚀', '⚡', '🛠️', '💡', '🎯', '📚', '🔧', '✨', '🌟', '🔑']

interface Props {
  collection: {
    id: string
    title: string
    description: string | null
    emoji: string | null
    visibility: string
    articleCount: number
    subCollectionCount: number
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
  const [visibility, setVisibility] = useState(collection.visibility)
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
    setVisibility(collection.visibility)
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
        body: JSON.stringify({ title: title.trim(), description: description.trim(), emoji, visibility }),
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
          <Button
            variant="ghost"
            size="sm"
            onClick={openEdit}
            className="h-auto py-0 px-0 text-xs text-muted-foreground hover:text-orange-500 hover:bg-transparent"
          >
            {t('edit')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleArchive}
            disabled={archiving}
            className="h-auto py-0 px-0 text-xs text-muted-foreground hover:text-foreground hover:bg-transparent"
          >
            {archiving ? '…' : collection.isArchived ? t('unarchive') : tc('archive')}
          </Button>
          {!demoMode && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setDeleteError(''); setDeleteOpen(true) }}
              className="h-auto py-0 px-0 text-xs text-muted-foreground hover:text-destructive hover:bg-transparent"
            >
              {tc('delete')}
            </Button>
          )}
        </div>
        {archiveError && <p className="text-xs text-destructive">{archiveError}</p>}
      </div>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('editCollection')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveEdit} className="space-y-4">
            {/* Emoji picker */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                {t('icon')}
              </label>
              <div className="flex flex-wrap gap-2">
                {EMOJI_OPTIONS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setEmoji(e)}
                    className={cn(
                      'w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-colors',
                      emoji === e ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
                    )}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                {t('title')} <span className="text-orange-500">*</span>
              </label>
              <Input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                {t('description')}
              </label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="resize-none"
              />
            </div>

            {/* Visibility */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                {t('visibility')}
              </label>
              <ToggleGroup
                type="single"
                value={visibility}
                onValueChange={(value) => { if (value) setVisibility(value) }}
                className="justify-start"
              >
                <ToggleGroupItem value="PUBLIC" className="gap-2">
                  <Globe className="w-4 h-4" />
                  {t('visibilityPublic')}
                </ToggleGroupItem>
                <ToggleGroupItem value="INTERNAL" className="gap-2">
                  <Lock className="w-4 h-4" />
                  {t('visibilityInternal')}
                </ToggleGroupItem>
              </ToggleGroup>
              {visibility !== collection.visibility && (
                <p className="text-xs text-orange-500 mt-1.5">
                  {visibility === 'PUBLIC'
                    ? t('visibilityChangeToPublic')
                    : t('visibilityChangeToInternal')}
                </p>
              )}
            </div>

            {editError && <p className="text-sm text-destructive">{editError}</p>}

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setEditOpen(false)}>
                {tc('cancel')}
              </Button>
              <Button type="submit" disabled={saving || !title.trim()}>
                {saving ? tc('saving') : t('saveChanges')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteCollection')}</AlertDialogTitle>
            <AlertDialogDescription>
              <strong className="text-foreground">{collection.title}</strong>
              {t('willBeDeleted')}
            </AlertDialogDescription>
            {collection.subCollectionCount > 0 && (
              <p className="text-sm text-destructive">
                {t('hasSubCollections', { count: collection.subCollectionCount })}
              </p>
            )}
            {collection.articleCount > 0 && (
              <p className="text-sm text-destructive">
                {t('hasArticles', { count: collection.articleCount })}
              </p>
            )}
            {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleting || collection.articleCount > 0 || collection.subCollectionCount > 0}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? tc('deleting') : tc('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
