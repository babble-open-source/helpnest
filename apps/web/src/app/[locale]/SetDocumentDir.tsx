'use client'

import { useEffect } from 'react'

export function SetDocumentDir({ dir, locale }: { dir: 'ltr' | 'rtl'; locale: string }) {
  useEffect(() => {
    document.documentElement.dir = dir
    document.documentElement.lang = locale
  }, [dir, locale])

  return null
}
