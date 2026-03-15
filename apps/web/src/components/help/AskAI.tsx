import { Link } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'

interface Props {
  workspace: string
}

export function AskAI({ workspace }: Props) {
  const t = useTranslations('askAI')
  return (
    <Link
      href={`/${workspace}/help/ask`}
      className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
    >
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
      {t('title')}
    </Link>
  )
}
