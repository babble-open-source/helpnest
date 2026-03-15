import { Link } from '@/i18n/navigation'
import { getTranslations } from 'next-intl/server'

export default async function NotFound() {
  const t = await getTranslations('notFound')
  return (
    <div className="min-h-screen bg-cream flex items-center justify-center">
      <div className="text-center">
        <p className="text-6xl mb-4">🪹</p>
        <h1 className="font-serif text-3xl text-ink mb-2">{t('workspaceNotFound')}</h1>
        <p className="text-muted mb-6">{t('workspaceNotFoundDescription')}</p>
        <Link href="/" className="text-accent hover:underline">{t('goHome')}</Link>
      </div>
    </div>
  )
}
