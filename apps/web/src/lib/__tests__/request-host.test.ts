import { describe, expect, it } from 'vitest'
import { getRequestHostname } from '../request-host'

describe('getRequestHostname', () => {
  it('prefers x-forwarded-host over host', () => {
    const headers = new Headers({
      host: 'fallback.helpnest.cloud',
      'x-forwarded-host': 'support.trybabble.io',
    })

    expect(getRequestHostname(headers)).toBe('support.trybabble.io')
  })

  it('strips ports from forwarded host values', () => {
    const headers = new Headers({
      host: 'fallback.helpnest.cloud:443',
      'x-forwarded-host': 'support.trybabble.io:8443',
    })

    expect(getRequestHostname(headers)).toBe('support.trybabble.io')
  })

  it('uses the first forwarded host when proxies append a list', () => {
    const headers = new Headers({
      host: 'fallback.helpnest.cloud',
      'x-forwarded-host': 'support.trybabble.io, fallback.helpnest.cloud',
    })

    expect(getRequestHostname(headers)).toBe('support.trybabble.io')
  })

  it('normalizes case and trailing dots', () => {
    const headers = new Headers({
      host: 'SUPPORT.TRYBABBLE.IO.',
    })

    expect(getRequestHostname(headers)).toBe('support.trybabble.io')
  })

  it('falls back to host when x-forwarded-host is absent', () => {
    const headers = new Headers({
      host: 'support.trybabble.io',
    })

    expect(getRequestHostname(headers)).toBe('support.trybabble.io')
  })
})
