'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

interface TooltipProps {
  content: string
  children: React.ReactNode
  side?: 'top' | 'bottom'
  align?: 'center' | 'start' | 'end'
  wrapperClassName?: string
}

export function Tooltip({ content, children, side = 'top', align = 'center', wrapperClassName }: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  function calcCoords() {
    if (!wrapperRef.current) return
    const r = wrapperRef.current.getBoundingClientRect()
    const GAP = 6

    let top: number
    if (side === 'bottom') {
      top = r.bottom + GAP
    } else {
      top = r.top - GAP // will subtract tooltip height via transform
    }

    let left: number
    if (align === 'start') {
      left = r.left
    } else if (align === 'end') {
      left = r.right
    } else {
      left = r.left + r.width / 2
    }

    setCoords({ top, left })
  }

  function handleMouseEnter() {
    calcCoords()
    setVisible(true)
  }

  const translateX =
    align === 'start' ? 'translateX(0)' :
    align === 'end'   ? 'translateX(-100%)' :
    'translateX(-50%)'

  const translateY = side === 'top' ? 'translateY(-100%)' : 'translateY(0)'

  return (
    <div
      ref={wrapperRef}
      className={`inline-flex${wrapperClassName ? ` ${wrapperClassName}` : ''}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {mounted && visible && createPortal(
        <span
          style={{
            position: 'fixed',
            top: coords.top,
            left: coords.left,
            transform: `${translateX} ${translateY}`,
            zIndex: 9999,
          }}
          className="pointer-events-none whitespace-nowrap bg-ink text-cream text-xs rounded px-2 py-1 shadow-md"
        >
          {content}
        </span>,
        document.body
      )}
    </div>
  )
}
