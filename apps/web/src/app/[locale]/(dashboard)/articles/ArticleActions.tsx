'use client'

import { useState } from 'react'
import { useRouter, Link } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { MoreHorizontal } from 'lucide-react'

interface Props {
  articleId: string
  articleTitle: string
  articleStatus: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  demoMode?: boolean
  isSeeded?: boolean
}

export function ArticleActions({ articleId, articleTitle, articleStatus, demoMode = false, isSeeded = false }: Props) {
  const router = useRouter()
  const tc = useTranslations('common')
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
        setError(data.error ?? tc('somethingWentWrong'))
        return
      }
      router.refresh()
    } catch {
      setError(tc('somethingWentWrong'))
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
        setError(data.error ?? tc('somethingWentWrong'))
        return
      }
      setConfirmOpen(false)
      router.refresh()
    } catch {
      setError(tc('somethingWentWrong'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <div className="flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Open menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/articles/${articleId}/edit`}>
                {tc('edit')}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleArchive}
              disabled={archiving}
            >
              {archiving ? '…' : articleStatus === 'ARCHIVED' ? tc('draft') : tc('archive')}
            </DropdownMenuItem>
            {(!demoMode || !isSeeded) && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => { setError(''); setConfirmOpen(true) }}
                  className="text-destructive focus:text-destructive"
                >
                  {tc('delete')}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tc('delete')}</AlertDialogTitle>
            <AlertDialogDescription>
              <strong className="text-foreground">&ldquo;{articleTitle}&rdquo;</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmOpen(false)}>
              {tc('cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
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
