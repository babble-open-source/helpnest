'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'

/**
 * Resets scroll position to the top on forward navigation (link clicks).
 *
 * Next.js App Router preserves scroll when navigating between pages that share
 * a layout and the Page element remains visible in the viewport. This component
 * forces a scroll-to-top on pathname changes with proper handling for:
 *
 * - **Back/forward navigation** — detected via `popstate`, skipped so the
 *   browser can restore the user's previous scroll position.
 * - **Hash fragments** — skipped so anchor links (e.g. TOC sidebar) scroll
 *   to the target element instead of the top.
 * - **Same-pathname changes** — skipped (e.g. search param updates).
 */
export function ScrollToTop() {
  const pathname = usePathname()
  const prevPathname = useRef(pathname)
  const isPop = useRef(false)

  // Track back/forward navigation via popstate — fires before React re-renders
  useEffect(() => {
    const onPopState = () => {
      isPop.current = true
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    if (prevPathname.current === pathname) return
    prevPathname.current = pathname

    // Back/forward — let the browser restore the previous scroll position
    if (isPop.current) {
      isPop.current = false
      return
    }

    // Anchor link — let the browser scroll to the fragment target
    if (window.location.hash) return

    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [pathname])

  return null
}
