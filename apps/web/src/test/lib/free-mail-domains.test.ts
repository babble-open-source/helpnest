import { describe, it, expect } from 'vitest'
import { FREE_MAIL_DOMAINS } from '@/lib/free-mail-domains'

describe('FREE_MAIL_DOMAINS', () => {
  it('is a Set', () => {
    expect(FREE_MAIL_DOMAINS).toBeInstanceOf(Set)
  })

  it('contains gmail.com', () => {
    expect(FREE_MAIL_DOMAINS.has('gmail.com')).toBe(true)
  })

  it('contains yahoo.com', () => {
    expect(FREE_MAIL_DOMAINS.has('yahoo.com')).toBe(true)
  })

  it('contains hotmail.com', () => {
    expect(FREE_MAIL_DOMAINS.has('hotmail.com')).toBe(true)
  })

  it('contains outlook.com', () => {
    expect(FREE_MAIL_DOMAINS.has('outlook.com')).toBe(true)
  })

  it('contains icloud.com', () => {
    expect(FREE_MAIL_DOMAINS.has('icloud.com')).toBe(true)
  })

  it('does not contain a corporate domain (acme.com)', () => {
    expect(FREE_MAIL_DOMAINS.has('acme.com')).toBe(false)
  })

  it('does not contain an enterprise domain (example.com)', () => {
    expect(FREE_MAIL_DOMAINS.has('example.com')).toBe(false)
  })
})
