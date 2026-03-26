'use client'

import { WorkspaceBrandLink } from '@/components/help/WorkspaceBrandLink'
import { useState } from 'react'
import { signOut } from 'next-auth/react'
import { Link, usePathname } from '@/i18n/navigation'
import { useLocale, useTranslations } from 'next-intl'
import NextImage from 'next/image'
import { InboxBadge } from './InboxBadge'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'

interface Props {
  workspaceId: string
  workspaceName: string
  workspaceLogo?: string | null
  workspaceBrandText?: string | null
  userName: string
  userEmail: string
  userInitial: string
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
  cloudMode,
}: Props) {
  const [open, setOpen] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()
  const locale = useLocale()
  const t = useTranslations('dashboard')
  const tc = useTranslations('common')

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

        {/* Workspace hub link — cloud mode only */}
        {open && (
          <a
            href={`/${locale}/workspaces`}
            className="flex items-center gap-3 px-4 py-3 hover:bg-white/10 transition-colors group"
          >
            {workspaceLogo ? (
              <NextImage src={workspaceLogo} alt="" width={32} height={32} unoptimized className="w-8 h-8 rounded-lg object-contain border border-white/10 bg-white p-1" />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-white/10 text-cream flex items-center justify-center text-sm font-medium">
                {workspaceName[0]?.toUpperCase() ?? '?'}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-cream truncate">{workspaceBrandText ?? workspaceName}</p>
            </div>
            <svg className="w-4 h-4 text-cream/40 group-hover:text-cream transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </a>
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
              <span className="lg:hidden">{t('billing')}</span>
              <span className={`hidden lg:block ${!open ? 'text-xs font-medium text-cream/60' : ''}`}>
                {open ? t('billing') : t('billingShort')}
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
