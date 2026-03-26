import { describe, it, expect } from 'vitest'
import { validateUrl } from '../url-validator'

describe('validateUrl', () => {
  it('accepts a valid https URL', () => {
    const result = validateUrl('https://example.com')
    expect(result).toEqual({ valid: true, url: 'https://example.com/', error: null })
  })

  it('accepts a valid http URL', () => {
    const result = validateUrl('http://example.com')
    expect(result).toEqual({ valid: true, url: 'http://example.com/', error: null })
  })

  it('rejects empty string', () => {
    const result = validateUrl('')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('URL is required')
  })

  it('rejects non-http protocols', () => {
    const result = validateUrl('ftp://example.com')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Only http and https URLs are supported')
  })

  it('rejects invalid URL format', () => {
    const result = validateUrl('not-a-url')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Invalid URL format')
  })

  it('rejects localhost URLs', () => {
    const result = validateUrl('http://localhost:3000')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Cannot crawl local or private addresses')
  })

  it('rejects 127.0.0.1', () => {
    const result = validateUrl('http://127.0.0.1')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Cannot crawl local or private addresses')
  })

  it('rejects private IP ranges (10.x)', () => {
    const result = validateUrl('http://10.0.0.1')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Cannot crawl local or private addresses')
  })

  it('rejects private IP ranges (192.168.x)', () => {
    const result = validateUrl('http://192.168.1.1')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Cannot crawl local or private addresses')
  })

  it('rejects URLs that are too long', () => {
    const longUrl = 'https://example.com/' + 'a'.repeat(2048)
    const result = validateUrl(longUrl)
    expect(result.valid).toBe(false)
    expect(result.error).toBe('URL is too long (max 2048 characters)')
  })

  it('trims whitespace from URL', () => {
    const result = validateUrl('  https://example.com  ')
    expect(result).toEqual({ valid: true, url: 'https://example.com/', error: null })
  })
})
