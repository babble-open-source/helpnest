'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

interface Heading {
  id: string
  text: string
  level: number
}

export function TableOfContents({
  headings,
  label,
}: {
  headings: Heading[]
  label: string
}) {
  const [activeId, setActiveId] = useState<string>(headings[0]?.id ?? '')
  const visibleIds = useRef(new Set<string>())

  const headingIds = useMemo(
    () => headings.map((h) => h.id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(headings.map((h) => h.id))],
  )

  useEffect(() => {
    const elements = headingIds
      .map((id) => document.getElementById(id))
      .filter(Boolean) as HTMLElement[]

    if (elements.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            visibleIds.current.add(entry.target.id)
          } else {
            visibleIds.current.delete(entry.target.id)
          }
        }

        // Pick the first visible heading in document order
        const first = headingIds.find((id) => visibleIds.current.has(id))
        if (first) setActiveId(first)
      },
      { rootMargin: '-10% 0px -70% 0px', threshold: 0 },
    )

    for (const el of elements) observer.observe(el)
    return () => {
      observer.disconnect()
      visibleIds.current.clear()
    }
  }, [headingIds])

  return (
    <div className="sticky top-20">
      <p className="text-xs font-medium text-muted uppercase tracking-wide mb-3">
        {label}
      </p>
      <nav className="space-y-0.5">
        {headings.map((h) => {
          const isActive = activeId === h.id
          return (
            <a
              key={h.id}
              href={`#${h.id}`}
              className={`block text-sm py-0.5 transition-colors border-l-2 ${
                h.level === 2 ? 'ps-3' : h.level === 3 ? 'ps-5' : 'ps-3'
              } ${
                isActive
                  ? 'border-accent text-ink font-medium'
                  : 'border-transparent text-muted hover:text-ink hover:border-border'
              }`}
            >
              {h.text}
            </a>
          )
        })}
      </nav>
    </div>
  )
}
