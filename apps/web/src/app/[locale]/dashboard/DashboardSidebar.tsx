'use client'

import { useState } from 'react'
import { signOut } from 'next-auth/react'
import { Link, usePathname } from '@/i18n/navigation'
import { useLocale, useTranslations } from 'next-intl'
import NextImage from 'next/image'
import { useTheme } from 'next-themes'
import {
  LayoutDashboard,
  Inbox,
  FileText,
  FolderOpen,
  AlertCircle,
  Upload,
  Settings,
  CreditCard,
  ChevronsLeft,
  ChevronsRight,
  Menu,
  X,
  LogOut,
  Moon,
  Sun,
  ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { InboxBadge } from './InboxBadge'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { cn } from '@/lib/utils'

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

const NAV_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  '/dashboard': LayoutDashboard,
  '/dashboard/inbox': Inbox,
  '/dashboard/articles': FileText,
  '/dashboard/collections': FolderOpen,
  '/dashboard/knowledge-gaps': AlertCircle,
  '/dashboard/imports': Upload,
  '/dashboard/settings': Settings,
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
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()
  const locale = useLocale()
  const t = useTranslations('dashboard')
  const tc = useTranslations('common')
  const { theme, setTheme } = useTheme()

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

  const sidebarContent = (isMobile: boolean) => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-4 shrink-0">
        <div className={cn('min-w-0 flex-1', !isMobile && collapsed && 'lg:hidden')}>
          <Link href="/dashboard" className="flex items-center gap-2">
            {workspaceLogo ? (
              <NextImage
                src={workspaceLogo}
                alt=""
                width={28}
                height={28}
                unoptimized
                className="w-7 h-7 rounded-md object-contain"
              />
            ) : (
              <div className="w-7 h-7 rounded-md bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold shrink-0">
                {workspaceName[0]?.toUpperCase() ?? '?'}
              </div>
            )}
            <span className="text-sm font-semibold text-foreground truncate">
              {workspaceBrandText ?? workspaceName}
            </span>
          </Link>
        </div>
        {!isMobile && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed((v) => !v)}
            title={collapsed ? tc('expandSidebar') : tc('collapseSidebar')}
            className="hidden lg:flex h-7 w-7 text-muted-foreground hover:text-foreground"
          >
            {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          </Button>
        )}
      </div>

      {/* Workspace switcher */}
      {(isMobile || !collapsed) && (
        <a
          href={`/${locale}/workspaces`}
          className="flex items-center gap-3 mx-2 px-2 py-2.5 rounded-lg hover:bg-accent text-foreground transition-colors group"
        >
          {workspaceLogo ? (
            <NextImage
              src={workspaceLogo}
              alt=""
              width={32}
              height={32}
              unoptimized
              className="w-8 h-8 rounded-lg object-contain border bg-card p-1"
            />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-muted text-muted-foreground flex items-center justify-center text-sm font-medium">
              {workspaceName[0]?.toUpperCase() ?? '?'}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{workspaceBrandText ?? workspaceName}</p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
        </a>
      )}

      <Separator className="my-1" />

      {/* Nav */}
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = NAV_ICONS[item.href]
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed && !isMobile ? item.label : undefined}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                isActive(item.href)
                  ? 'bg-accent text-accent-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              )}
            >
              {Icon && <Icon className="w-4 h-4 shrink-0" />}
              {(isMobile || !collapsed) && <span>{item.label}</span>}
              {item.href === '/dashboard/inbox' && (isMobile || !collapsed) && (
                <InboxBadge workspaceId={workspaceId} />
              )}
            </Link>
          )
        })}

        {cloudMode && (
          <Link
            href="/dashboard/billing"
            onClick={() => setMobileOpen(false)}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
              isActive('/dashboard/billing')
                ? 'bg-accent text-accent-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent'
            )}
          >
            <CreditCard className="w-4 h-4 shrink-0" />
            {(isMobile || !collapsed) && <span>{t('billing')}</span>}
          </Link>
        )}
      </nav>

      {/* Footer */}
      <div className="p-2 space-y-1 shrink-0">
        {(isMobile || !collapsed) && (
          <div className="px-2 py-1">
            <LanguageSwitcher className="w-full bg-background text-sm border border-input rounded-md px-2 py-1 pr-7 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer" />
          </div>
        )}

        <Separator />

        {/* Theme toggle */}
        <Button
          variant="ghost"
          size={collapsed && !isMobile ? 'icon' : 'default'}
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className={cn(
            'w-full text-muted-foreground hover:text-foreground',
            collapsed && !isMobile ? 'h-9 w-9 mx-auto' : 'justify-start gap-3 px-3'
          )}
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          {(isMobile || !collapsed) && (
            <span className="text-sm">{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
          )}
        </Button>

        {/* User */}
        <div className={cn(
          'flex items-center gap-3 px-2 py-2 rounded-lg',
          collapsed && !isMobile && 'justify-center px-0'
        )}>
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className="bg-primary text-primary-foreground text-sm font-medium">
              {userInitial}
            </AvatarFallback>
          </Avatar>
          {(isMobile || !collapsed) && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{userName}</p>
                <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => signOut({ callbackUrl: `/${locale}/login` })}
                title={tc('signOut')}
                className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-50 h-14 bg-background border-b flex items-center px-4">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 -ms-1 me-3 text-muted-foreground">
              <Menu className="h-5 w-5" />
              <span className="sr-only">{tc('openMenu')}</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0 bg-background">
            <SheetTitle className="sr-only">{tc('openMenu')}</SheetTitle>
            {sidebarContent(true)}
          </SheetContent>
        </Sheet>
        <Link href="/dashboard" className="flex items-center gap-2">
          {workspaceLogo ? (
            <NextImage src={workspaceLogo} alt="" width={24} height={24} unoptimized className="w-6 h-6 rounded object-contain" />
          ) : (
            <div className="w-6 h-6 rounded bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold">
              {workspaceName[0]?.toUpperCase() ?? '?'}
            </div>
          )}
          <span className="text-sm font-semibold text-foreground">{workspaceBrandText ?? workspaceName}</span>
        </Link>
      </div>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden lg:flex flex-col border-r bg-background shrink-0 overflow-hidden transition-[width] duration-200',
          collapsed ? 'w-14' : 'w-60'
        )}
      >
        {sidebarContent(false)}
      </aside>
    </>
  )
}
