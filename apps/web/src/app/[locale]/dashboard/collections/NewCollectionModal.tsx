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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Globe, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'

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
      <Button onClick={() => setOpen(true)}>
        {isSubCollection ? t('newSubCollection') : t('newCollection')}
      </Button>

      <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) close() }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isSubCollection ? t('createSubCollection') : t('createCollection')}
            </DialogTitle>
            {isSubCollection && parentTitle && (
              <p className="text-xs text-muted-foreground mt-0.5">{t('inCollection', { title: parentTitle })}</p>
            )}
          </DialogHeader>

          <form onSubmit={submit} className="space-y-4">
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
                placeholder={t('placeholder')}
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
                placeholder={t('descriptionPlaceholder')}
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
                onValueChange={(value) => { if (value) setVisibility(value as 'PUBLIC' | 'INTERNAL') }}
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
              <p className="text-xs text-muted-foreground mt-1.5">
                {visibility === 'PUBLIC'
                  ? t('visibilityPublicDescription')
                  : t('visibilityInternalDescription')}
              </p>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={close}>
                {tc('cancel')}
              </Button>
              <Button type="submit" disabled={saving || !title.trim()}>
                {saving ? t('creating') : isSubCollection ? t('createSubCollection') : t('createCollection')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
