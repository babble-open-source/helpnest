import { describe, it, expect } from 'vitest'
import { parseRobotsTxt } from '../robots-txt'

describe('parseRobotsTxt', () => {
  it('returns isAllowed function that blocks disallowed paths', () => {
    const content = `User-agent: *\nDisallow: /admin\nDisallow: /private/`
    const { isAllowed } = parseRobotsTxt(content)
    expect(isAllowed('https://acme.com/admin')).toBe(false)
    expect(isAllowed('https://acme.com/admin/settings')).toBe(false)
    expect(isAllowed('https://acme.com/private/docs')).toBe(false)
    expect(isAllowed('https://acme.com/features')).toBe(true)
  })

  it('respects HelpNestBot-specific rules over wildcard', () => {
    const content = `User-agent: *\nDisallow: /\n\nUser-agent: HelpNestBot\nDisallow: /secret\nAllow: /`
    const { isAllowed } = parseRobotsTxt(content)
    expect(isAllowed('https://acme.com/features')).toBe(true)
    expect(isAllowed('https://acme.com/secret')).toBe(false)
  })

  it('allows everything when robots.txt is empty', () => {
    const { isAllowed } = parseRobotsTxt('')
    expect(isAllowed('https://acme.com/anything')).toBe(true)
  })

  it('allows everything when no matching user-agent', () => {
    const content = `User-agent: Googlebot\nDisallow: /`
    const { isAllowed } = parseRobotsTxt(content)
    expect(isAllowed('https://acme.com/anything')).toBe(true)
  })

  it('handles Allow directives', () => {
    const content = `User-agent: *\nDisallow: /docs\nAllow: /docs/public`
    const { isAllowed } = parseRobotsTxt(content)
    expect(isAllowed('https://acme.com/docs/private')).toBe(false)
    expect(isAllowed('https://acme.com/docs/public')).toBe(true)
    expect(isAllowed('https://acme.com/docs/public/page')).toBe(true)
  })

  it('returns disallowed paths list', () => {
    const content = `User-agent: *\nDisallow: /admin\nDisallow: /private`
    const { disallowedPaths } = parseRobotsTxt(content)
    expect(disallowedPaths).toContain('/admin')
    expect(disallowedPaths).toContain('/private')
  })
})
