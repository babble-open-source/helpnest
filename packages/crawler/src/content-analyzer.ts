interface AnalysisResult {
  contentType: 'marketing' | 'docs' | 'app-ui' | 'other'
  sensitiveDataWarnings: string[]
  tooShort: boolean
  language: string | null
}

const DOCS_SIGNALS = [
  /\bfaq\b/i,
  /\bhow to\b/i,
  /\bstep \d/i,
  /\btutorial\b/i,
  /\bguide\b/i,
  /\bdocumentation\b/i,
  /\btroubleshoot/i,
  /\bhelp center\b/i,
  /^\d+\.\s/m,
]

const MARKETING_SIGNALS = [
  /\bpricing\b/i,
  /\$\d+/,
  /\/mo\b/i,
  /\bfeatures?\b/i,
  /\benterprise\b/i,
  /\bfree trial\b/i,
  /\bget started\b/i,
  /\bsign up\b/i,
  /\bunlimited\b/i,
]

const SENSITIVE_PATTERNS: [RegExp, string][] = [
  [/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, 'Email addresses detected'],
  [/\b(sk|pk|api|key|token|secret)[_-][a-zA-Z0-9]{16,}/gi, 'Possible API keys detected'],
  [/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, 'IP addresses detected'],
]

const MIN_CONTENT_LENGTH = 100

export function analyzeContent(markdown: string, url: string): AnalysisResult {
  const contentType = classifyContentType(markdown, url)
  const sensitiveDataWarnings = detectSensitiveData(markdown)
  const tooShort = markdown.trim().length < MIN_CONTENT_LENGTH

  return {
    contentType,
    sensitiveDataWarnings,
    tooShort,
    language: null,
  }
}

function classifyContentType(
  markdown: string,
  url: string,
): 'marketing' | 'docs' | 'app-ui' | 'other' {
  const combined = markdown + ' ' + url

  let docsScore = 0
  let marketingScore = 0

  for (const signal of DOCS_SIGNALS) {
    if (signal.test(combined)) docsScore++
  }

  for (const signal of MARKETING_SIGNALS) {
    if (signal.test(combined)) marketingScore++
  }

  if (docsScore > marketingScore && docsScore >= 2) return 'docs'
  if (marketingScore > docsScore && marketingScore >= 2) return 'marketing'
  if (docsScore >= 1 && (url.includes('/docs') || url.includes('/faq') || url.includes('/help'))) return 'docs'
  if (marketingScore >= 1 && (url.includes('/pricing') || url.includes('/features'))) return 'marketing'

  return 'other'
}

function detectSensitiveData(markdown: string): string[] {
  const warnings: string[] = []

  for (const [pattern, message] of SENSITIVE_PATTERNS) {
    pattern.lastIndex = 0
    if (pattern.test(markdown)) {
      warnings.push(message)
    }
  }

  return warnings
}
