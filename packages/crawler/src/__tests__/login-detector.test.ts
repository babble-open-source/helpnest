import { describe, it, expect } from 'vitest'
import { detectLoginWall } from '../login-detector'

describe('detectLoginWall', () => {
  it('detects login form by password input', () => {
    const html = `<html><body><form><input type="password" /><button>Sign In</button></form></body></html>`
    expect(detectLoginWall(html, 'https://acme.com/settings')).toBe(true)
  })

  it('detects login page by URL pattern', () => {
    const html = '<html><body><h1>Welcome</h1></body></html>'
    expect(detectLoginWall(html, 'https://acme.com/login')).toBe(true)
    expect(detectLoginWall(html, 'https://acme.com/signin')).toBe(true)
    expect(detectLoginWall(html, 'https://acme.com/auth/callback')).toBe(true)
  })

  it('does not flag normal pages as login walls', () => {
    const html = `<html><body><h1>Features</h1><p>Our product has great features.</p></body></html>`
    expect(detectLoginWall(html, 'https://acme.com/features')).toBe(false)
  })

  it('detects SSO/OAuth redirects in URL', () => {
    expect(detectLoginWall('', 'https://acme.com/sso/redirect')).toBe(true)
    expect(detectLoginWall('', 'https://acme.com/oauth/authorize')).toBe(true)
  })

  it('detects login form by common button text', () => {
    const html = `<html><body><form action="/login"><input type="email" /><button>Log in</button></form></body></html>`
    expect(detectLoginWall(html, 'https://acme.com/app')).toBe(true)
  })

  it('does not flag search forms as login walls', () => {
    const html = `<html><body><form><input type="text" placeholder="Search..." /><button>Search</button></form></body></html>`
    expect(detectLoginWall(html, 'https://acme.com/docs')).toBe(false)
  })
})
