'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { CrawlModal, type Collection } from './CrawlModal'
import { Button } from '@/components/ui/button'

export function ImportFromWebsiteButton() {
  const t = useTranslations('crawl')
  const [open, setOpen] = useState(false)
  const [collections, setCollections] = useState<Collection[]>([])
  const [loading, setLoading] = useState(false)

  async function handleOpen() {
    setLoading(true)
    try {
      const res = await fetch('/api/collections')
      if (res.ok) {
        const data = (await res.json()) as { data: Collection[] }
        setCollections(
          (data.data ?? []).map((c) => ({
            id: c.id,
            title: c.title,
            parentId: c.parentId ?? null,
          }))
        )
      }
    } catch {
      setCollections([])
    } finally {
      setLoading(false)
      setOpen(true)
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleOpen}
        disabled={loading}
        className="shrink-0"
      >
        {loading ? t('loading') : t('importFromWebsite')}
      </Button>

      {open && (
        <CrawlModal
          collections={collections}
          onClose={() => setOpen(false)}
          onSuccess={() => {}}
        />
      )}
    </>
  )
}
