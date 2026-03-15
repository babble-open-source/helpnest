import { ImportSourceCard } from './ImportSourceCard'
import { getTranslations } from 'next-intl/server'

export const metadata = { title: 'Imports' }

export default async function ImportsPage() {
  const t = await getTranslations('importsPage')

  const SOURCES = [
    {
      id: 'notion' as const,
      name: t('notion'),
      description: t('notionDescription'),
    },
    {
      id: 'intercom' as const,
      name: t('intercom'),
      description: t('intercomDescription'),
    },
    {
      id: 'zendesk' as const,
      name: t('zendesk'),
      description: t('zendeskDescription'),
    },
    {
      id: 'freshdesk' as const,
      name: t('freshdesk'),
      description: t('freshdeskDescription'),
    },
    {
      id: 'helpscout' as const,
      name: t('helpscout'),
      description: t('helpscoutDescription'),
    },
    {
      id: 'csv' as const,
      name: t('csv'),
      description: t('csvDescription'),
    },
    {
      id: 'mintlify' as const,
      name: t('mintlify'),
      description: t('mintlifyDescription'),
      comingSoon: true,
    },
  ]

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="font-serif text-3xl text-ink mb-2">{t('title')}</h1>
        <p className="text-muted text-sm">
          {t('description')}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {SOURCES.map((source) => (
          <ImportSourceCard key={source.id} source={source} />
        ))}
      </div>
    </div>
  )
}
