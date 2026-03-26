interface ValidationResult {
  valid: boolean
  url: string | null
  error: string | null
}

const BLOCKED_HOSTNAMES = ['localhost', '0.0.0.0', '[::1]', '[::0]']

const PRIVATE_IP_PREFIXES = [
  '127.',
  '10.',
  '192.168.',
  '169.254.',
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

const BLOCKED_IPV6_PREFIXES = ['::1', '::0', 'fc00:', 'fd00:', 'fe80:', '::ffff:127.', '::ffff:10.', '::ffff:192.168.', '::ffff:169.254.']

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
  // Strip brackets from IPv6 addresses for comparison
  const bareHost = hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname

  if (
    BLOCKED_HOSTNAMES.includes(hostname) ||
    PRIVATE_IP_PREFIXES.some((prefix) => hostname.startsWith(prefix)) ||
    BLOCKED_IPV6_PREFIXES.some((prefix) => bareHost.startsWith(prefix)) ||
    bareHost === '::1' ||
    bareHost === '::' ||
    bareHost === '0:0:0:0:0:0:0:1'
  ) {
    return { valid: false, url: null, error: 'Cannot crawl local or private addresses' }
  }

  return { valid: true, url: parsed.href, error: null }
}
