import { describe, it, expect } from 'vitest'
import { slugify } from '../slugify'

describe('slugify', () => {
  describe('basic conversion', () => {
    it('lowercases ASCII letters', () => {
      expect(slugify('Hello World')).toBe('hello-world')
    })

    it('converts spaces to hyphens', () => {
      expect(slugify('foo bar baz')).toBe('foo-bar-baz')
    })

    it('preserves digits', () => {
      expect(slugify('Article 42')).toBe('article-42')
    })

    it('handles a string that is already a valid slug', () => {
      expect(slugify('already-slugified')).toBe('already-slugified')
    })

    it('handles a purely numeric string', () => {
      expect(slugify('12345')).toBe('12345')
    })
  })

  describe('special characters', () => {
    it('replaces punctuation with a single hyphen', () => {
      expect(slugify('Hello, World!')).toBe('hello-world')
    })

    it('collapses consecutive special characters into one hyphen', () => {
      expect(slugify('foo --- bar')).toBe('foo-bar')
    })

    it('strips apostrophes', () => {
      expect(slugify("What's New")).toBe('what-s-new')
    })

    it('strips forward slashes', () => {
      expect(slugify('path/to/page')).toBe('path-to-page')
    })

    it('strips percent-encoded sequences (treats % as non-alphanumeric)', () => {
      expect(slugify('100%')).toBe('100')
    })

    it('replaces ampersand with a hyphen', () => {
      expect(slugify('Cats & Dogs')).toBe('cats-dogs')
    })
  })

  describe('unicode characters', () => {
    it('removes accented latin characters', () => {
      // é, ñ, ü are all non-ASCII — they fall outside [a-z0-9]
      expect(slugify('Héllo Wörld')).toBe('h-llo-w-rld')
    })

    it('removes CJK characters', () => {
      expect(slugify('日本語')).toBe('')
    })

    it('handles a mix of ASCII and unicode', () => {
      expect(slugify('Café Paris')).toBe('caf-paris')
    })
  })

  describe('edge cases — empty and whitespace', () => {
    it('returns empty string for empty input', () => {
      expect(slugify('')).toBe('')
    })

    it('returns empty string for whitespace-only input', () => {
      expect(slugify('   ')).toBe('')
    })

    it('returns empty string for a string of only special characters', () => {
      expect(slugify('!@#$%^&*()')).toBe('')
    })
  })

  describe('leading and trailing hyphens', () => {
    it('strips a leading hyphen produced by a leading special character', () => {
      expect(slugify('!hello')).toBe('hello')
    })

    it('strips a trailing hyphen produced by a trailing special character', () => {
      expect(slugify('hello!')).toBe('hello')
    })

    it('strips both leading and trailing hyphens', () => {
      expect(slugify('!hello world!')).toBe('hello-world')
    })
  })

  describe('length truncation', () => {
    it('truncates output to exactly 200 characters', () => {
      // 201 'a' characters — the result should be exactly 200 'a's
      const input = 'a'.repeat(201)
      const result = slugify(input)
      expect(result).toHaveLength(200)
      expect(result).toBe('a'.repeat(200))
    })

    it('accepts exactly 200 characters without truncation', () => {
      const input = 'a'.repeat(200)
      expect(slugify(input)).toBe('a'.repeat(200))
    })

    it('truncates a 300-char string to 200 characters', () => {
      const input = 'b'.repeat(300)
      expect(slugify(input)).toHaveLength(200)
    })

    // Hyphens inserted by the replace step count toward the 200-char limit;
    // truncation happens after all replacements.
    it('applies the 200-char limit after all character replacements', () => {
      // 100 "ab " segments → "ab-ab-ab-..." which is longer than 200 chars
      const input = 'ab '.repeat(100)
      const result = slugify(input)
      expect(result.length).toBeLessThanOrEqual(200)
    })
  })
})
