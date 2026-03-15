'use client'

import { useEffect } from 'react'

export function SetDocumentDir({ dir }: { dir: 'ltr' | 'rtl' }) {
  useEffect(() => {
    document.documentElement.dir = dir
    document.documentElement.lang = document.querySelector('[lang]')?.getAttribute('lang') || 'en'
  }, [dir])

  return null
}
