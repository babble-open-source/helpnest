'use client'

import { useLocale } from 'next-intl'
import { usePathname, useRouter } from '@/i18n/navigation'
import { locales, localeNames, type Locale } from '@/i18n/config'
import { useTransition } from 'react'
import {
  Select,
  SelectGroup,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface LanguageSwitcherProps {
  className?: string
  variant?: 'default' | 'sidebar'
}

export function LanguageSwitcher({ className, variant = 'default' }: LanguageSwitcherProps = {}) {
  const locale = useLocale() as Locale
  const pathname = usePathname()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function onValueChange(newLocale: string) {
    startTransition(() => {
      router.replace(pathname, { locale: newLocale as Locale })
    })
  }

  return (
    <Select value={locale} onValueChange={onValueChange} disabled={isPending}>
      <SelectTrigger className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent variant={variant}>
        <SelectGroup>
          {locales.map((loc) => (
            <SelectItem key={loc} value={loc} variant={variant}>
              {localeNames[loc]}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
