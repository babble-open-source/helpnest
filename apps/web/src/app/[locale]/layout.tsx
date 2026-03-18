import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { routing } from '@/i18n/routing'
import { isRtlLocale, type Locale } from '@/i18n/config'
import { SetDocumentDir } from './SetDocumentDir'

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  if (!routing.locales.includes(locale as Locale)) {
    notFound()
  }

  const messages = await getMessages()
  const dir = isRtlLocale(locale) ? 'rtl' : 'ltr'

  return (
    <div lang={locale} dir={dir}>
      <SetDocumentDir dir={dir} locale={locale} />
      <NextIntlClientProvider messages={messages}>
        {children}
      </NextIntlClientProvider>
    </div>
  )
}
