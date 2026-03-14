import { ImportSourceCard } from './ImportSourceCard'

export const metadata = { title: 'Imports' }

const SOURCES = [
  {
    id: 'notion' as const,
    name: 'Notion',
    description: 'Import pages and databases from your Notion workspace.',
  },
  {
    id: 'intercom' as const,
    name: 'Intercom',
    description: 'Migrate your Intercom Articles help center content.',
  },
  {
    id: 'zendesk' as const,
    name: 'Zendesk',
    description: 'Import articles from Zendesk Guide help center.',
  },
  {
    id: 'freshdesk' as const,
    name: 'Freshdesk',
    description: 'Migrate solution articles from Freshdesk.',
  },
  {
    id: 'helpscout' as const,
    name: 'Help Scout',
    description: 'Import Docs collections and articles from Help Scout.',
  },
  {
    id: 'csv' as const,
    name: 'CSV / Markdown',
    description: 'Upload a CSV file or Markdown files to bulk-import articles.',
  },
  {
    id: 'mintlify' as const,
    name: 'Mintlify',
    description: 'Import from a local Mintlify docs project.',
    comingSoon: true,
  },
]

export default function ImportsPage() {
  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="font-serif text-3xl text-ink mb-2">Imports</h1>
        <p className="text-muted text-sm">
          Migrate existing content from your current help center platform into HelpNest. Collections and articles will be created automatically.
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
