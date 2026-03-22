'use client'

import { WorkspaceBrandLink } from '@/components/help/WorkspaceBrandLink'
import { useState, useRef, useEffect } from 'react'
import { signOut } from 'next-auth/react'
import { Link, usePathname } from '@/i18n/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { InboxBadge } from './InboxBadge'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'

interface WorkspaceItem {
  id: string
  name: string
  slug: string
  logo: string | null
  role: string
}

interface Props {
  workspaceId: string
  workspaceName: string
  workspaceLogo?: string | null
  workspaceBrandText?: string | null
  userName: string
  userEmail: string
  userInitial: string
  workspaces?: WorkspaceItem[]
  cloudMode?: boolean
}

export function DashboardSidebar({
  workspaceId,
  workspaceName,
  workspaceLogo,
  workspaceBrandText,
  userName,
  userEmail,
  userInitial,
  workspaces,
  cloudMode,
}: Props) {
  const [open, setOpen] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [wsMenuOpen, setWsMenuOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const pathname = usePathname()
  const locale = useLocale()
  const t = useTranslations('dashboard')
  const tc = useTranslations('common')

  const hasMultiWorkspace = !!workspaces && workspaces.length > 0
  const wsMenuRef = useRef<HTMLDivElement>(null)

  // Close workspace dropdown on outside click
  useEffect(() => {
    if (!wsMenuOpen) return
    function handleClick(e: MouseEvent) {
      if (wsMenuRef.current && !wsMenuRef.current.contains(e.target as Node)) {
        setWsMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [wsMenuOpen])

  async function switchWorkspace(targetId: string) {
    if (targetId === workspaceId) {
      setWsMenuOpen(false)
      return
    }
    try {
      const res = await fetch('/api/workspaces/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: targetId }),
      })
      if (!res.ok) return
      setWsMenuOpen(false)
      window.location.assign(`/${locale}/dashboard`)
    } catch {
      // Network error — do nothing
    }
  }

  async function createWorkspace() {
    if (!newName.trim()) return
    setCreateError(null)
    setCreating(true)
    try {
      const res = await fetch('/api/workspaces/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setCreateError(data.error ?? 'Failed to create workspace')
        setCreating(false)
        return
      }
      setNewName('')
      setWsMenuOpen(false)
      window.location.assign(`/${locale}/dashboard`)
    } catch {
      setCreateError('Network error')
      setCreating(false)
    }
  }

  const navItems = [
    { href: '/dashboard', label: t('overview') },
    { href: '/dashboard/inbox', label: t('inbox') },
    { href: '/dashboard/articles', label: t('articles') },
    { href: '/dashboard/collections', label: t('collections') },
    { href: '/dashboard/knowledge-gaps', label: t('gaps') },
    { href: '/dashboard/imports', label: t('imports') },
    { href: '/dashboard/settings', label: t('settings') },
  ]

  function isActive(href: string) {
    return href === '/dashboard' ? pathname === href : pathname.startsWith(href)
  }

  return (
    <>
      {/* Mobile top bar — visible only on small screens */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-50 h-14 bg-ink text-cream flex items-center px-4 border-b border-white/10">
        <button
          onClick={() => setMobileOpen(true)}
          title={tc('openMenu')}
          className="p-1.5 rounded text-cream/60 hover:text-cream hover:bg-white/10 transition-colors -ms-1 me-3 shrink-0"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
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
      </div>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={[
          'bg-ink text-cream flex flex-col shrink-0 overflow-hidden',
          // Mobile: fixed drawer that slides in from left
          'fixed inset-y-0 start-0 z-40 w-64',
          'transition-transform duration-200',
          mobileOpen ? 'translate-x-0 rtl:-translate-x-0' : '-translate-x-full rtl:translate-x-full',
          // Desktop: static, width-based collapse
          'lg:static lg:translate-x-0 lg:transition-[width] lg:duration-200',
          open ? 'lg:w-60' : 'lg:w-12',
        ].join(' ')}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-4 border-b border-white/10 shrink-0">
          {/* Brand — always visible on mobile; on desktop only when expanded */}
          <div className={`min-w-0 flex-1 ${open ? '' : 'lg:hidden'}`.trim()}>
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
          </div>
          {/* Mobile close button */}
          <button
            onClick={() => setMobileOpen(false)}
            title={tc('closeMenu')}
            className="lg:hidden p-1.5 rounded text-cream/60 hover:text-cream hover:bg-white/10 transition-colors shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          {/* Desktop collapse/expand button */}
          <button
            onClick={() => setOpen((v) => !v)}
            title={open ? tc('collapseSidebar') : tc('expandSidebar')}
            className="hidden lg:block p-1.5 rounded text-cream/60 hover:text-cream hover:bg-white/10 transition-colors shrink-0"
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

        {/* Workspace switcher — cloud mode only */}
        {hasMultiWorkspace && open && (
          <div ref={wsMenuRef} className="px-2 py-2 border-b border-white/10 shrink-0 relative">
            <button
              onClick={() => setWsMenuOpen(!wsMenuOpen)}
              className="w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm text-cream/80 hover:text-cream hover:bg-white/10 transition-colors"
            >
              <span className="truncate">{workspaceName}</span>
              <svg className={`w-3.5 h-3.5 shrink-0 transition-transform ${wsMenuOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {wsMenuOpen && (
              <div className="absolute start-2 end-2 top-full mt-1 bg-ink border border-white/20 rounded-lg shadow-xl z-50 overflow-hidden">
                <div className="max-h-48 overflow-y-auto">
                  {workspaces!.map((ws) => (
                    <button
                      key={ws.id}
                      onClick={() => switchWorkspace(ws.id)}
                      className={`w-full text-start px-3 py-2 text-sm transition-colors ${
                        ws.id === workspaceId
                          ? 'bg-white/15 text-cream font-medium'
                          : 'text-cream/70 hover:bg-white/10 hover:text-cream'
                      }`}
                    >
                      <span className="block truncate">{ws.name}</span>
                      <span className="block text-xs text-cream/40 truncate">
                        {ws.slug}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="border-t border-white/10 p-2">
                  {createError && (
                    <p className="text-xs text-red-400 px-1 pb-1">{createError}</p>
                  )}
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && createWorkspace()}
                      placeholder="New workspace..."
                      className="flex-1 min-w-0 bg-white/10 border border-white/20 rounded px-2 py-1 text-xs text-cream placeholder:text-cream/40 focus:outline-none focus:ring-1 focus:ring-white/40"
                    />
                    <button
                      onClick={createWorkspace}
                      disabled={creating || !newName.trim()}
                      className="px-2 py-1 bg-accent text-white text-xs rounded hover:bg-accent/90 disabled:opacity-50 shrink-0"
                    >
                      {creating ? '...' : '+'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              title={!open ? item.label : undefined}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive(item.href)
                  ? 'bg-white/15 text-cream font-medium'
                  : 'text-cream/70 hover:text-cream hover:bg-white/10'
              }`}
            >
              {/* Mobile: always show full label */}
              <span className="lg:hidden">{item.label}</span>
              {/* Desktop: full label when expanded, first char when collapsed */}
              <span className={`hidden lg:block ${!open ? 'text-xs font-medium text-cream/60' : ''}`}>
                {open ? item.label : item.label[0]}
              </span>
              {item.href === '/dashboard/inbox' && open && (
                <InboxBadge workspaceId={workspaceId} />
              )}
            </Link>
          ))}
        </nav>

        {/* Billing — only in cloud mode */}
        {cloudMode && (
          <div className="px-2 pb-2">
            <Link
              href="/dashboard/billing"
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive('/dashboard/billing')
                  ? 'bg-white/15 text-cream font-medium'
                  : 'text-cream/70 hover:text-cream hover:bg-white/10'
              }`}
            >
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              <span className="lg:hidden">Billing</span>
              <span className={`hidden lg:block ${!open ? 'text-xs font-medium text-cream/60' : ''}`}>
                {open ? 'Billing' : 'B'}
              </span>
            </Link>
          </div>
        )}

        {/* User */}
        <div className="p-2 border-t border-white/10 shrink-0">
          {/* Language switcher — mobile: always visible; desktop: only when expanded */}
          <div className={`px-2 py-1.5 lg:hidden`}>
            <LanguageSwitcher className="w-full bg-transparent text-sm border border-white/20 rounded-md px-2 py-1 pr-7 text-cream/70 hover:text-cream focus:outline-none focus:ring-1 focus:ring-white/40 cursor-pointer disabled:opacity-50" />
          </div>
          {open && (
            <div className="hidden lg:block px-2 py-1.5">
              <LanguageSwitcher className="w-full bg-transparent text-sm border border-white/20 rounded-md px-2 py-1 pr-7 text-cream/70 hover:text-cream focus:outline-none focus:ring-1 focus:ring-white/40 cursor-pointer disabled:opacity-50" />
            </div>
          )}
          {/* Mobile: always show full user row */}
          <div className="flex items-center gap-3 px-2 py-2 lg:hidden">
            <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white text-sm font-medium shrink-0">
              {userInitial}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-cream truncate">{userName}</p>
              <p className="text-xs text-cream/50 truncate">{userEmail}</p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: `/${locale}/login` })}
              title={tc('signOut')}
              className="p-1.5 rounded text-cream/40 hover:text-cream hover:bg-white/10 transition-colors shrink-0"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
          {/* Desktop: expanded or collapsed user */}
          {open ? (
            <div className="hidden lg:flex items-center gap-3 px-2 py-2">
              <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white text-sm font-medium shrink-0">
                {userInitial}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-cream truncate">{userName}</p>
                <p className="text-xs text-cream/50 truncate">{userEmail}</p>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: `/${locale}/login` })}
                title={tc('signOut')}
                className="p-1.5 rounded text-cream/40 hover:text-cream hover:bg-white/10 transition-colors shrink-0"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          ) : (
            <button
              onClick={() => signOut({ callbackUrl: `/${locale}/login` })}
              title={tc('signOut')}
              className="hidden lg:flex w-full items-center justify-center p-1.5 rounded text-cream/40 hover:text-cream hover:bg-white/10 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          )}
        </div>
      </aside>
    </>
  )
}
