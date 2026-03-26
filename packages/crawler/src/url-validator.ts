interface ValidationResult {
  valid: boolean
  url: string | null
  error: string | null
}

const BLOCKED_HOSTNAMES = ['localhost', '0.0.0.0']

const PRIVATE_IP_PREFIXES = [
  '127.',
  '10.',
  '192.168.',
  '172.16.',
  '172.17.',
  '172.18.',
  '172.19.',
  '172.20.',
  '172.21.',
  '172.22.',
  '172.23.',
  '172.24.',
  '172.25.',
  '172.26.',
  '172.27.',
  '172.28.',
  '172.29.',
  '172.30.',
  '172.31.',
]

export function validateUrl(input: string): ValidationResult {
  const trimmed = input.trim()

  if (!trimmed) {
    return { valid: false, url: null, error: 'URL is required' }
  }

  if (trimmed.length > 2048) {
    return { valid: false, url: null, error: 'URL is too long (max 2048 characters)' }
  }

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return { valid: false, url: null, error: 'Invalid URL format' }
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { valid: false, url: null, error: 'Only http and https URLs are supported' }
  }

  const hostname = parsed.hostname
  if (
    BLOCKED_HOSTNAMES.includes(hostname) ||
    PRIVATE_IP_PREFIXES.some((prefix) => hostname.startsWith(prefix))
  ) {
    return { valid: false, url: null, error: 'Cannot crawl local or private addresses' }
  }

  return { valid: true, url: parsed.href, error: null }
}
