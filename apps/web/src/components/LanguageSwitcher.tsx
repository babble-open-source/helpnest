'use client'

import { useLocale } from 'next-intl'
import { usePathname, useRouter } from '@/i18n/navigation'
import { locales, localeNames, type Locale } from '@/i18n/config'
import { useTransition } from 'react'

interface LanguageSwitcherProps {
  className?: string
}

export function LanguageSwitcher({ className }: LanguageSwitcherProps = {}) {
  const locale = useLocale() as Locale
  const pathname = usePathname()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function onSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newLocale = e.target.value as Locale
    startTransition(() => {
      router.replace(pathname, { locale: newLocale })
    })
  }

  return (
    <select
      value={locale}
      onChange={onSelectChange}
      disabled={isPending}
      className={
        className ??
        'bg-transparent text-sm border border-[rgb(var(--color-border))] rounded-md px-2 py-1 text-[rgb(var(--color-muted))] hover:text-[rgb(var(--color-ink))] focus:outline-none focus:ring-1 focus:ring-[rgb(var(--color-accent))] cursor-pointer disabled:opacity-50'
      }
      aria-label="Select language"
    >
      {locales.map((loc) => (
        <option key={loc} value={loc}>
          {localeNames[loc]}
        </option>
      ))}
    </select>
  )
}
