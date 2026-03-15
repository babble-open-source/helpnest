export const locales = ['en', 'es', 'zh', 'ar', 'hi', 'fr', 'pt'] as const
export type Locale = (typeof locales)[number]
export const defaultLocale: Locale = 'en'

export const localeNames: Record<Locale, string> = {
  en: 'English',
  es: 'Español',
  zh: '中文',
  ar: 'العربية',
  hi: 'हिन्दी',
  fr: 'Français',
  pt: 'Português',
}

export const rtlLocales: Locale[] = ['ar']

export function isRtlLocale(locale: string): boolean {
  return rtlLocales.includes(locale as Locale)
}
