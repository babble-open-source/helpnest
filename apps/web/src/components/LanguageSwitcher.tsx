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

  const defaultClass =
    'bg-transparent text-sm border border-[rgb(var(--color-border))] rounded-md px-2 py-1 pr-7 text-[rgb(var(--color-muted))] hover:text-[rgb(var(--color-ink))] focus:outline-none focus:ring-1 focus:ring-[rgb(var(--color-accent))] cursor-pointer disabled:opacity-50'

  return (
    <div className="relative inline-flex">
      <select
        value={locale}
        onChange={onSelectChange}
        disabled={isPending}
        className={`appearance-none ${className ?? defaultClass}`}
        aria-label="Select language"
      >
        {locales.map((loc) => (
          <option key={loc} value={loc}>
            {localeNames[loc]}
          </option>
        ))}
      </select>
      <svg
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 opacity-60"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
          clipRule="evenodd"
        />
      </svg>
    </div>
  )
}
