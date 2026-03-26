'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { CrawlModal, type Collection } from './CrawlModal'

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
      <button
        type="button"
        onClick={handleOpen}
        disabled={loading}
        className="border border-border text-ink px-3 sm:px-4 py-2 rounded-lg text-sm hover:bg-cream transition-colors font-medium shrink-0 disabled:opacity-50"
      >
        {loading ? t('loading') : t('importFromWebsite')}
      </button>

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
