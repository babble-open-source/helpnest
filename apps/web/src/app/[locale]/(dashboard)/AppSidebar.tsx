'use client'

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
  LogOut,
  Moon,
  Sun,
  ChevronsUpDown,
  Plus,
  Check,
} from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
  side?: 'left' | 'right'
}

const NAV_ITEMS = [
  { href: '/', icon: LayoutDashboard, labelKey: 'overview' },
  { href: '/inbox', icon: Inbox, labelKey: 'inbox' },
  { href: '/articles', icon: FileText, labelKey: 'articles' },
  { href: '/collections', icon: FolderOpen, labelKey: 'collections' },
  { href: '/knowledge-gaps', icon: AlertCircle, labelKey: 'gaps' },
  { href: '/imports', icon: Upload, labelKey: 'imports' },
  { href: '/settings', icon: Settings, labelKey: 'settings' },
] as const

export function AppSidebar({
  workspaceId,
  workspaceName,
  workspaceLogo,
  workspaceBrandText,
  allWorkspaces,
  userName,
  userEmail,
  userInitial,
  cloudMode,
  side = 'left',
}: Props) {
  const pathname = usePathname()
  const locale = useLocale()
  const t = useTranslations('dashboard')
  const tc = useTranslations('common')
  const { theme, setTheme } = useTheme()
  const { setOpenMobile } = useSidebar()

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.cookie = `dashboard_theme=${next}; path=/; max-age=${60 * 60 * 24 * 365}`
    document.documentElement.classList.toggle('dark', next === 'dark')
    document.body.classList.toggle('dark', next === 'dark')
    const b = document.body
    if (next === 'dark') {
      b.style.setProperty('--color-background','10 10 12')
      b.style.setProperty('--color-foreground','237 237 237')
      b.style.setProperty('--color-card','23 23 26')
      b.style.setProperty('--color-card-foreground','237 237 237')
      b.style.setProperty('--color-popover','23 23 26')
      b.style.setProperty('--color-popover-foreground','237 237 237')
      b.style.setProperty('--color-primary','237 237 237')
      b.style.setProperty('--color-primary-foreground','10 10 12')
      b.style.setProperty('--color-muted','32 32 36')
      b.style.setProperty('--color-muted-foreground','140 140 150')
      b.style.setProperty('--color-accent','32 32 36')
      b.style.setProperty('--color-accent-foreground','237 237 237')
      b.style.setProperty('--color-border','35 35 39')
      b.style.setProperty('--color-input','35 35 39')
      b.style.setProperty('--color-ring','100 100 110')
    } else {
      b.style.setProperty('--color-background','255 255 255')
      b.style.setProperty('--color-foreground','9 9 11')
      b.style.setProperty('--color-card','255 255 255')
      b.style.setProperty('--color-card-foreground','9 9 11')
      b.style.setProperty('--color-popover','255 255 255')
      b.style.setProperty('--color-popover-foreground','9 9 11')
      b.style.setProperty('--color-primary','24 24 27')
      b.style.setProperty('--color-primary-foreground','250 250 250')
      b.style.setProperty('--color-muted','244 244 245')
      b.style.setProperty('--color-muted-foreground','113 113 122')
      b.style.setProperty('--color-accent','244 244 245')
      b.style.setProperty('--color-accent-foreground','24 24 27')
      b.style.setProperty('--color-border','229 229 232')
      b.style.setProperty('--color-input','229 229 232')
      b.style.setProperty('--color-ring','24 24 27')
    }
  }

  async function switchWorkspace(targetId: string) {
    if (targetId === workspaceId) return
    await fetch('/api/workspaces/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId: targetId }),
    })
    window.location.assign('/')
  }

  function isActive(href: string) {
    return href === '/' ? pathname === '/' || pathname === '' : pathname.startsWith(href)
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

  return (
    <Sidebar collapsible="icon" variant="inset" side={side}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  {workspaceIcon()}
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">{displayName}</span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                variant="sidebar"
                className="w-[--radix-dropdown-menu-trigger-width] min-w-64 rounded-lg p-1.5"
                align="start"
                side="bottom"
                sideOffset={4}
              >
                <div className="px-2 py-1.5 text-xs font-medium text-sidebar-foreground/70">
                  {tc('workspaces')}
                </div>
                {allWorkspaces.map((ws) => (
                  <DropdownMenuItem
                    key={ws.id}
                    onClick={() => switchWorkspace(ws.id)}
                    className={cn(
                      'cursor-pointer gap-2.5 rounded-md',
                      ws.id === workspaceId && 'bg-sidebar-accent text-sidebar-accent-foreground'
                    )}
                    variant="sidebar"
                  >
                    {ws.logo ? (
                      <NextImage src={ws.logo} alt="" width={20} height={20} unoptimized className="w-5 h-5 rounded object-contain shrink-0" />
                    ) : (
                      <div className="w-5 h-5 rounded bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-semibold shrink-0">
                        {ws.name[0]?.toUpperCase() ?? '?'}
                      </div>
                    )}
                    <span className="truncate flex-1">{ws.name}</span>
                    {ws.id === workspaceId && <Check className="ml-auto size-4" />}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator variant="sidebar" />
                <DropdownMenuItem
                  asChild
                  className="rounded-md"
                  variant="sidebar"
                >
                  <Link href="/workspaces" className="cursor-pointer">
                    <Plus className="size-4 mr-2" />
                    {tc('createWorkspace')}
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.href)}
                    tooltip={t(item.labelKey)}
                    onClick={() => setOpenMobile(false)}
                  >
                    <Link href={item.href}>
                      <item.icon />
                      <span>{t(item.labelKey)}</span>
                    </Link>
                  </SidebarMenuButton>
                  {item.href === '/inbox' && (
                    <SidebarMenuBadge>
                      <InboxBadge workspaceId={workspaceId} />
                    </SidebarMenuBadge>
                  )}
                </SidebarMenuItem>
              ))}
              {cloudMode && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive('/billing')}
                    tooltip={t('billing')}
                    onClick={() => setOpenMobile(false)}
                  >
                    <Link href="/billing">
                      <CreditCard />
                      <span>{t('billing')}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="group-data-[collapsible=icon]:hidden">
              <LanguageSwitcher className="w-full h-8 text-sm" variant="sidebar" />
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarSeparator />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={toggleTheme}
              tooltip={theme === 'dark' ? tc('lightMode') : tc('darkMode')}
            >
              {theme === 'dark' ? <Sun /> : <Moon />}
              <span>{theme === 'dark' ? tc('lightMode') : tc('darkMode')}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarFallback className="rounded-lg bg-primary text-primary-foreground text-xs font-medium">
                      {userInitial}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">{userName}</span>
                    <span className="truncate text-xs text-muted-foreground">{userEmail}</span>
                  </div>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                variant="sidebar"
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                side="bottom"
                align="end"
                sideOffset={4}
              >
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{userName}</p>
                  <p className="text-xs text-sidebar-foreground/70">{userEmail}</p>
                </div>
                <DropdownMenuSeparator variant="sidebar" />
                <DropdownMenuItem
                  onClick={() => signOut({ callbackUrl: `/${locale}/login` })}
                  className="cursor-pointer text-destructive focus:bg-sidebar-accent focus:text-destructive"
                  variant="sidebar"
                >
                  <LogOut className="size-4 mr-2" />
                  {tc('signOut')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
