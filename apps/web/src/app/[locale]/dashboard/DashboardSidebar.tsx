'use client'

import { useState, useEffect } from 'react'
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
  LogOut,
  Moon,
  Sun,
  ChevronsUpDown,
  Building2,
  Plus,
  Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SimpleTooltip } from '@/components/ui/simple-tooltip'
import { InboxBadge } from './InboxBadge'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { cn } from '@/lib/utils'

interface Props {
  workspaceId: string
  workspaceName: string
  workspaceLogo?: string | null
  workspaceBrandText?: string | null
  allWorkspaces: { id: string; name: string; slug: string; logo: string | null }[]
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
  allWorkspaces,
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
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  async function switchWorkspace(targetId: string) {
    if (targetId === workspaceId) return
    await fetch('/api/workspaces/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId: targetId }),
    })
    window.location.assign('/dashboard')
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

  const displayName = workspaceBrandText ?? workspaceName

  const workspaceIcon = (size: 'sm' | 'md' = 'md') => {
    const cls = size === 'sm' ? 'w-6 h-6 text-[10px]' : 'w-7 h-7 text-xs'
    return workspaceLogo ? (
      <NextImage
        src={workspaceLogo}
        alt=""
        width={size === 'sm' ? 24 : 28}
        height={size === 'sm' ? 24 : 28}
        unoptimized
        className={cn(cls, 'rounded-md object-contain shrink-0')}
      />
    ) : (
      <div className={cn(cls, 'rounded-md bg-primary text-primary-foreground flex items-center justify-center font-semibold shrink-0')}>
        {workspaceName[0]?.toUpperCase() ?? '?'}
      </div>
    )
  }

  const sidebarContent = (isMobile: boolean) => (
    <div className="flex flex-col h-full">
      {/* Workspace header */}
      <div className={cn(
        'flex items-center shrink-0',
        isMobile || !collapsed ? 'gap-1 px-2 py-3' : 'flex-col gap-1.5 px-1 py-3'
      )}>
        {(isMobile || !collapsed) ? (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2.5 flex-1 min-w-0 px-2 py-1.5 rounded-lg hover:bg-accent transition-colors text-left cursor-pointer">
                  {workspaceIcon()}
                  <span className="text-sm font-semibold text-foreground truncate flex-1">
                    {displayName}
                  </span>
                  <ChevronsUpDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Workspaces</div>
                {allWorkspaces.map((ws) => (
                  <DropdownMenuItem
                    key={ws.id}
                    onClick={() => switchWorkspace(ws.id)}
                    className={cn('cursor-pointer flex items-center gap-2.5', ws.id === workspaceId && 'bg-accent')}
                  >
                      {ws.logo ? (
                        <NextImage src={ws.logo} alt="" width={20} height={20} unoptimized className="w-5 h-5 rounded object-contain shrink-0" />
                      ) : (
                        <div className="w-5 h-5 rounded bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-semibold shrink-0">
                          {ws.name[0]?.toUpperCase() ?? '?'}
                        </div>
                      )}
                      <span className="truncate flex-1">{ws.name}</span>
                      {ws.id === workspaceId && <Check className="w-4 h-4 text-foreground shrink-0" />}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <a href={`/${locale}/onboarding`} className="cursor-pointer">
                    <Plus className="w-4 h-4 mr-2" />
                    Create workspace
                  </a>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {!isMobile && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCollapsed((v) => !v)}
                title={tc('collapseSidebar')}
                className="hidden lg:flex h-7 w-7 text-muted-foreground hover:text-foreground shrink-0"
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
            )}
          </>
        ) : (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="cursor-pointer rounded-lg p-1 hover:bg-accent transition-colors">
                  {workspaceIcon('sm')}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="start" className="w-64">
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Workspaces</div>
                {allWorkspaces.map((ws) => (
                  <DropdownMenuItem
                    key={ws.id}
                    onClick={() => switchWorkspace(ws.id)}
                    className={cn('cursor-pointer flex items-center gap-2.5', ws.id === workspaceId && 'bg-accent')}
                  >
                      {ws.logo ? (
                        <NextImage src={ws.logo} alt="" width={20} height={20} unoptimized className="w-5 h-5 rounded object-contain shrink-0" />
                      ) : (
                        <div className="w-5 h-5 rounded bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-semibold shrink-0">
                          {ws.name[0]?.toUpperCase() ?? '?'}
                        </div>
                      )}
                      <span className="truncate flex-1">{ws.name}</span>
                      {ws.id === workspaceId && <Check className="w-4 h-4 text-foreground shrink-0" />}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <a href={`/${locale}/onboarding`} className="cursor-pointer">
                    <Plus className="w-4 h-4 mr-2" />
                    Create workspace
                  </a>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCollapsed((v) => !v)}
              title={tc('expandSidebar')}
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
            >
              <ChevronsRight className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
      </div>

      <Separator />

      {/* Nav */}
      <nav className={cn('flex-1 space-y-0.5 overflow-y-auto', isMobile || !collapsed ? 'p-2' : 'px-1 py-2')}>
        {navItems.map((item) => {
          const Icon = NAV_ICONS[item.href]
          const isCollapsed = !isMobile && collapsed
          return (
            <SimpleTooltip key={item.href} content={item.label} side="right" wrapperClassName={isCollapsed ? 'block' : undefined}>
              <Link
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'flex items-center rounded-lg text-sm transition-colors',
                  isCollapsed ? 'justify-center p-2' : 'gap-3 px-3 py-2',
                  isActive(item.href)
                    ? 'bg-accent text-accent-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                )}
              >
                {Icon && <Icon className="w-4 h-4 shrink-0" />}
                {!isCollapsed && <span>{item.label}</span>}
                {item.href === '/dashboard/inbox' && !isCollapsed && (
                  <InboxBadge workspaceId={workspaceId} />
                )}
              </Link>
            </SimpleTooltip>
          )
        })}

        {cloudMode && (
          <SimpleTooltip content={t('billing')} side="right" wrapperClassName={!isMobile && collapsed ? 'block' : undefined}>
            <Link
              href="/dashboard/billing"
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center rounded-lg text-sm transition-colors',
                !isMobile && collapsed ? 'justify-center p-2' : 'gap-3 px-3 py-2',
                isActive('/dashboard/billing')
                  ? 'bg-accent text-accent-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              )}
            >
              <CreditCard className="w-4 h-4 shrink-0" />
              {(isMobile || !collapsed) && <span>{t('billing')}</span>}
            </Link>
          </SimpleTooltip>
        )}
      </nav>

      {/* Footer */}
      <div className={cn('space-y-1 shrink-0', isMobile || !collapsed ? 'p-2' : 'px-1 py-2')}>
        {(isMobile || !collapsed) && (
          <div className="px-2 py-1">
            <LanguageSwitcher className="w-full bg-background text-sm border border-input rounded-md px-2 py-1 pr-7 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer" />
          </div>
        )}

        <Separator />

        {/* Theme toggle */}
        {mounted && (
          <SimpleTooltip content={theme === 'dark' ? 'Light mode' : 'Dark mode'} side="right">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className={cn(
                'text-muted-foreground hover:text-foreground',
                isMobile || !collapsed ? 'w-full justify-start gap-3 px-3 h-9' : 'h-8 w-8 mx-auto'
              )}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {(isMobile || !collapsed) && (
                <span className="text-sm">{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
              )}
            </Button>
          </SimpleTooltip>
        )}

        {/* User */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={cn(
              'flex items-center rounded-lg w-full hover:bg-accent transition-colors',
              isMobile || !collapsed ? 'gap-3 px-2 py-2' : 'justify-center p-2'
            )}>
              <Avatar className={cn('shrink-0', isMobile || !collapsed ? 'h-8 w-8' : 'h-7 w-7')}>
                <AvatarFallback className="bg-primary text-primary-foreground text-xs font-medium">
                  {userInitial}
                </AvatarFallback>
              </Avatar>
              {(isMobile || !collapsed) && (
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-medium text-foreground truncate">{userName}</p>
                  <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
                </div>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side={isMobile || !collapsed ? 'top' : 'right'} className="w-56">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{userName}</p>
              <p className="text-xs text-muted-foreground">{userEmail}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOut({ callbackUrl: `/${locale}/login` })} className="cursor-pointer text-destructive focus:text-destructive">
              <LogOut className="w-4 h-4 mr-2" />
              {tc('signOut')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-50 h-14 bg-background border-b flex items-center px-4">
        {mounted && (
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
        )}
        <Link href="/dashboard" className="flex items-center gap-2">
          {workspaceLogo ? (
            <NextImage src={workspaceLogo} alt="" width={24} height={24} unoptimized className="w-6 h-6 rounded object-contain" />
          ) : (
            <div className="w-6 h-6 rounded bg-zinc-900 text-zinc-50 flex items-center justify-center text-xs font-semibold">
              {workspaceName[0]?.toUpperCase() ?? '?'}
            </div>
          )}
          <span className="text-sm font-semibold">{displayName}</span>
        </Link>
      </div>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden lg:flex flex-col border-r bg-background shrink-0 overflow-hidden transition-[width] duration-200',
          collapsed ? 'w-14' : 'w-60'
        )}
      >
        {mounted ? sidebarContent(false) : (
          <div className="flex items-center gap-2 px-4 py-3">
            <div className="w-7 h-7 rounded-md bg-zinc-200 shrink-0" />
            <div className="h-4 w-32 bg-zinc-200 rounded" />
          </div>
        )}
      </aside>
    </>
  )
}
