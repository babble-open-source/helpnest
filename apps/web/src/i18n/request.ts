import { getRequestConfig } from 'next-intl/server'
import { routing } from './routing'
import { type Locale } from './config'

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale

  // Validate that the incoming locale is supported
  if (!locale || !routing.locales.includes(locale as Locale)) {
    locale = routing.defaultLocale
  }

  const userMessages = (await import(`../messages/${locale}.json`)).default
  const defaultMessages = (await import('../messages/en.json')).default

  return {
    locale,
    // Merge: English fallback + locale overrides
    messages: { ...defaultMessages, ...userMessages },
  }
})
