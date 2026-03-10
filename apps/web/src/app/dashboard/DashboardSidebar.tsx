'use client'

import { WorkspaceBrandLink } from '@/components/help/WorkspaceBrandLink'
import { useState } from 'react'
import { signOut } from 'next-auth/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/articles', label: 'Articles' },
  { href: '/dashboard/collections', label: 'Collections' },
  { href: '/dashboard/settings', label: 'Settings' },
]

interface Props {
  workspaceName: string
  workspaceLogo?: string | null
  workspaceBrandText?: string | null
  userName: string
  userEmail: string
  userInitial: string
}

export function DashboardSidebar({
  workspaceName,
  workspaceLogo,
  workspaceBrandText,
  userName,
  userEmail,
  userInitial,
}: Props) {
  const [open, setOpen] = useState(true)
  const pathname = usePathname()

  function isActive(href: string) {
    // '/dashboard' requires an exact match so it doesn't highlight for all sub-routes.
    return href === '/dashboard' ? pathname === href : pathname.startsWith(href)
  }

  return (
    <aside
      className={`${open ? 'w-60' : 'w-12'} bg-ink text-cream flex flex-col shrink-0 transition-[width] duration-200 overflow-hidden`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-4 border-b border-white/10 shrink-0">
        {open && (
          <WorkspaceBrandLink
            href="/dashboard"
            name={workspaceName}
            logo={workspaceLogo}
            brandText={workspaceBrandText}
            hideNameWhenLogo
            textClassName="font-serif text-lg text-cream"
            markClassName="border-white/10 bg-white p-1.5"
            fallbackClassName="text-ink"
          />
        )}
        <button
          onClick={() => setOpen((v) => !v)}
          title={open ? 'Collapse sidebar' : 'Expand sidebar'}
          className="p-1.5 rounded text-cream/60 hover:text-cream hover:bg-white/10 transition-colors shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {open ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7M18 19l-7-7 7-7" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M6 5l7 7-7 7" />
            )}
          </svg>
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            title={!open ? item.label : undefined}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
              isActive(item.href)
                ? 'bg-white/15 text-cream font-medium'
                : 'text-cream/70 hover:text-cream hover:bg-white/10'
            }`}
          >
            {open ? item.label : <span className="text-xs font-medium text-cream/60">{item.label[0]}</span>}
          </Link>
        ))}
      </nav>

      {/* User */}
      <div className="p-2 border-t border-white/10 shrink-0">
        {open ? (
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white text-sm font-medium shrink-0">
              {userInitial}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-cream truncate">{userName}</p>
              <p className="text-xs text-cream/50 truncate">{userEmail}</p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              title="Sign out"
              className="p-1.5 rounded text-cream/40 hover:text-cream hover:bg-white/10 transition-colors shrink-0"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        ) : (
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            title="Sign out"
            className="w-full flex items-center justify-center p-1.5 rounded text-cream/40 hover:text-cream hover:bg-white/10 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        )}
      </div>
    </aside>
  )
}
