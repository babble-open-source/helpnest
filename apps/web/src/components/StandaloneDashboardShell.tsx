'use client'

import { useEffect } from 'react'

import { cn } from '@/lib/utils'

const LIGHT_THEME_VARS = {
  '--color-background': '255 255 255',
  '--color-foreground': '9 9 11',
  '--color-card': '255 255 255',
  '--color-card-foreground': '9 9 11',
  '--color-popover': '255 255 255',
  '--color-popover-foreground': '9 9 11',
  '--color-primary': '24 24 27',
  '--color-primary-foreground': '250 250 250',
  '--color-secondary': '244 244 245',
  '--color-secondary-foreground': '24 24 27',
  '--color-muted': '244 244 245',
  '--color-muted-foreground': '113 113 122',
  '--color-accent': '244 244 245',
  '--color-accent-foreground': '24 24 27',
  '--color-border': '229 229 232',
  '--color-input': '229 229 232',
  '--color-ring': '24 24 27',
  '--input-color': 'rgba(9, 9, 11, 0.12)',
} as const

const DARK_THEME_VARS = {
  '--color-background': '10 10 12',
  '--color-foreground': '237 237 237',
  '--color-card': '23 23 26',
  '--color-card-foreground': '237 237 237',
  '--color-popover': '23 23 26',
  '--color-popover-foreground': '237 237 237',
  '--color-primary': '237 237 237',
  '--color-primary-foreground': '10 10 12',
  '--color-secondary': '32 32 36',
  '--color-secondary-foreground': '237 237 237',
  '--color-muted': '32 32 36',
  '--color-muted-foreground': '140 140 150',
  '--color-accent': '32 32 36',
  '--color-accent-foreground': '237 237 237',
  '--color-border': '35 35 39',
  '--color-input': '35 35 39',
  '--color-ring': '100 100 110',
  '--input-color': 'rgba(255, 255, 255, 0.10)',
} as const

const THEME_KEYS = Object.keys(LIGHT_THEME_VARS) as Array<keyof typeof LIGHT_THEME_VARS>

interface StandaloneDashboardShellProps {
  children: React.ReactNode
  className?: string
  initialTheme?: 'light' | 'dark'
}

export function StandaloneDashboardShell({ children, className, initialTheme = 'light' }: StandaloneDashboardShellProps) {
  useEffect(() => {
    const root = document.documentElement
    const body = document.body
    const isDark = document.cookie.match(/(?:^|;\s*)dashboard_theme=([^;]+)/)?.[1] === 'dark'
    const themeVars = isDark ? DARK_THEME_VARS : LIGHT_THEME_VARS

    const prevRootDark = root.classList.contains('dark')
    const prevRootDashboard = root.classList.contains('dashboard-root')
    const prevBodyDark = body.classList.contains('dark')
    const prevBodyDashboard = body.classList.contains('dashboard-root')
    const prevBodyOverflow = body.style.overflow
    const prevRootVars = new Map(THEME_KEYS.map((key) => [key, root.style.getPropertyValue(key)]))
    const prevBodyVars = new Map(THEME_KEYS.map((key) => [key, body.style.getPropertyValue(key)]))

    root.classList.add('dashboard-root')
    body.classList.add('dashboard-root')
    root.classList.toggle('dark', isDark)
    body.classList.toggle('dark', isDark)
    body.style.overflow = 'hidden'

    for (const [key, value] of Object.entries(themeVars)) {
      root.style.setProperty(key, value)
      body.style.setProperty(key, value)
    }

    return () => {
      root.classList.toggle('dark', prevRootDark)
      body.classList.toggle('dark', prevBodyDark)

      if (!prevRootDashboard) root.classList.remove('dashboard-root')
      if (!prevBodyDashboard) body.classList.remove('dashboard-root')

      body.style.overflow = prevBodyOverflow

      for (const key of THEME_KEYS) {
        const rootValue = prevRootVars.get(key) ?? ''
        const bodyValue = prevBodyVars.get(key) ?? ''
        if (rootValue) root.style.setProperty(key, rootValue)
        else root.style.removeProperty(key)
        if (bodyValue) body.style.setProperty(key, bodyValue)
        else body.style.removeProperty(key)
      }
    }
  }, [])

  const initialVars = initialTheme === 'dark' ? DARK_THEME_VARS : LIGHT_THEME_VARS

  return (
    <div
      className={cn(
        'dashboard-root h-dvh overflow-y-auto overscroll-none bg-background text-foreground',
        initialTheme === 'dark' && 'dark',
        className
      )}
      style={{ fontFamily: "'Inter', system-ui, sans-serif", ...initialVars }}
    >
      {children}
    </div>
  )
}
