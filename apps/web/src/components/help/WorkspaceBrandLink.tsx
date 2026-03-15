import { Link } from '@/i18n/navigation'

interface Props {
  href: string
  name: string
  logo?: string | null
  brandText?: string | null
  hideNameWhenLogo?: boolean
  className?: string
  textClassName?: string
  markClassName?: string
  fallbackClassName?: string
}

export function WorkspaceBrandLink({
  href,
  name,
  logo,
  brandText,
  hideNameWhenLogo = false,
  className = '',
  textClassName = '',
  markClassName = '',
  fallbackClassName = '',
}: Props) {
  const initial = name.trim().charAt(0).toUpperCase() || 'H'
  const trimmedBrandText = brandText?.trim() ?? ''
  const displayName = !logo && trimmedBrandText.length > 0 ? trimmedBrandText : name
  const shouldShowName = !logo || !hideNameWhenLogo

  return (
    <Link href={href} className={`flex min-w-0 items-center gap-3 ${className}`.trim()}>
      {logo ? (
        <span
          className={`h-8 min-w-[2.25rem] max-w-[9rem] shrink-0 items-center justify-start overflow-hidden ${markClassName}`.trim()}
        >
          <img
            src={logo}
            alt={`${name} logo`}
            className="block h-full w-auto max-w-full object-contain object-left"
          />
        </span>
      ) : (
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-white p-1 ${markClassName}`.trim()}
        >
          <span className={`text-sm font-semibold text-ink ${fallbackClassName}`.trim()}>
            {initial}
          </span>
        </span>
      )}
      {shouldShowName && (
        <span
          className={`truncate ${textClassName}`.trim()}
          style={!logo ? { fontFamily: 'var(--font-brand, inherit)' } : undefined}
        >
          {displayName}
        </span>
      )}
    </Link>
  )
}
