/**
 * Public signup can be closed, but only on purpose.
 *
 * HelpNest is self-hosted by people who need signup to work out of the box, so the
 * gate defaults to OPEN. It is the hosted deployment that closes it — hiding the
 * "Sign up" link in a marketing header is not the same thing as refusing to create
 * an account, and anyone with the URL can POST to the endpoint directly.
 */

import { describe, it, expect, afterEach } from 'vitest'
import { isPublicSignupEnabled } from '@/lib/signup-gate'

const original = process.env['PUBLIC_SIGNUP_ENABLED']

afterEach(() => {
  if (original === undefined) delete process.env['PUBLIC_SIGNUP_ENABLED']
  else process.env['PUBLIC_SIGNUP_ENABLED'] = original
})

describe('isPublicSignupEnabled', () => {
  it('is OPEN by default — a self-hosted install must work with no config', () => {
    delete process.env['PUBLIC_SIGNUP_ENABLED']
    expect(isPublicSignupEnabled()).toBe(true)
  })

  it('closes only on an explicit "false"', () => {
    process.env['PUBLIC_SIGNUP_ENABLED'] = 'false'
    expect(isPublicSignupEnabled()).toBe(false)
  })

  it('accepts common spellings of false, so a deployment typo does not silently reopen signup', () => {
    for (const value of ['false', 'FALSE', 'False', ' false ', '0', 'no']) {
      process.env['PUBLIC_SIGNUP_ENABLED'] = value
      expect(isPublicSignupEnabled(), `value: ${JSON.stringify(value)}`).toBe(false)
    }
  })

  it('stays open for any affirmative or unrecognised value', () => {
    for (const value of ['true', 'TRUE', '1', 'yes', '']) {
      process.env['PUBLIC_SIGNUP_ENABLED'] = value
      expect(isPublicSignupEnabled(), `value: ${JSON.stringify(value)}`).toBe(true)
    }
  })
})
