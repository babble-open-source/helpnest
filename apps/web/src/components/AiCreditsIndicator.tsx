'use client'

interface AiCreditsIndicatorProps {
  used: number
  limit: number // -1 = unlimited (BYOK)
  remaining: number // -1 = unlimited
}

export function AiCreditsIndicator({ used: _used, limit, remaining }: AiCreditsIndicatorProps) {
  if (limit === -1) return null // BYOK users — don't show anything

  const isLow = remaining <= 2 && remaining > 0
  const isExhausted = remaining === 0

  return (
    <div
      className={`text-xs ${isExhausted ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-muted'}`}
    >
      {isExhausted
        ? 'No free articles remaining. Add your AI key in settings to continue.'
        : `${remaining} free article${remaining === 1 ? '' : 's'} remaining`}
    </div>
  )
}
