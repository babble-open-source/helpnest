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

// Only trust x-helpnest-host when we know a Cloudflare Worker is in front
// (indicated by CLOUDFLARE_FALLBACK_ORIGIN being configured). Without this,
// any HTTP client could spoof the header to impersonate another workspace.
const TRUST_HELPNEST_HOST_HEADER = !!process.env.CLOUDFLARE_FALLBACK_ORIGIN

export function getRequestHostname(headers: HeaderSource): string {
  return (
    // X-HelpNest-Host is set by the BYOD Cloudflare Worker — only trusted
    // when we know the Cloudflare proxy is configured
    (TRUST_HELPNEST_HOST_HEADER && normalizeHostValue(headers.get('x-helpnest-host'))) ||
    normalizeHostValue(headers.get('x-forwarded-host')) ||
    normalizeHostValue(headers.get('host'))
  )
}
