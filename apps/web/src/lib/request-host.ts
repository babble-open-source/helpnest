type HeaderSource = Pick<Headers, 'get'>

function normalizeHostValue(value: string | null | undefined): string {
  if (!value) return ''

  const first = value
    .split(',')[0]
    ?.trim()
    .toLowerCase()
    .replace(/\.$/, '')

  if (!first) return ''

  if (first.startsWith('[')) {
    const end = first.indexOf(']')
    return end >= 0 ? first.slice(1, end) : first
  }

  const colonCount = first.split(':').length - 1
  if (colonCount === 1) {
    return first.split(':')[0] ?? ''
  }

  return first
}

export function getRequestHostname(headers: HeaderSource): string {
  return (
    normalizeHostValue(headers.get('x-forwarded-host')) ||
    normalizeHostValue(headers.get('host'))
  )
}
