'use client'

import { Link } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'

export function DefaultPasswordBanner() {
  const t = useTranslations('security')

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 flex items-center justify-between gap-4">
      <p className="text-sm text-amber-800">
        <span className="font-medium">{t('notice')}</span> {t('defaultPassword')}
      </p>
      <Link
        href="/dashboard/settings"
        className="shrink-0 text-sm font-medium text-amber-900 underline underline-offset-2 hover:text-amber-700"
      >
        {t('changePasswordLink')}
      </Link>
    </div>
  )
}
