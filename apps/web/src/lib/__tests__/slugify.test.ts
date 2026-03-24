import { describe, it, expect } from 'vitest'
import { slugify } from '../slugify'

describe('slugify()', () => {
  describe('basic conversions', () => {
    it('should convert to lowercase', () => {
      expect(slugify('HELLO')).toBe('hello')
      expect(slugify('HeLLo')).toBe('hello')
      expect(slugify('Getting Started')).toBe('getting-started')
    })

    it('should replace spaces with hyphens', () => {
      expect(slugify('Hello World')).toBe('hello-world')
      expect(slugify('Getting Started Guide')).toBe('getting-started-guide')
      expect(slugify('New Article Title')).toBe('new-article-title')
    })

    it('should replace multiple spaces with single hyphen', () => {
      expect(slugify('Multiple   Spaces')).toBe('multiple-spaces')
      expect(slugify('Text  with   many    spaces')).toBe('text-with-many-spaces')
    })

    it('should strip leading and trailing spaces', () => {
      expect(slugify('  Spaces  ')).toBe('spaces')
      expect(slugify('   Leading')).toBe('leading')
      expect(slugify('Trailing   ')).toBe('trailing')
    })

    it('should strip leading and trailing hyphens', () => {
      expect(slugify('-hello-')).toBe('hello')
      expect(slugify('--multiple--')).toBe('multiple')
    })
  })

  describe('special character handling', () => {
    it('should remove special characters', () => {
      expect(slugify('Special!@#$%Chars')).toBe('special-chars')
      expect(slugify('Exclamation!')).toBe('exclamation')
      expect(slugify('Question?')).toBe('question')
    })

    it('should remove punctuation', () => {
      expect(slugify('Hello, World!')).toBe('hello-world')
      expect(slugify('What?')).toBe('what')
      expect(slugify('Test.')).toBe('test')
    })

    it('should remove parentheses', () => {
      expect(slugify('API (v2)')).toBe('api-v2')
      expect(slugify('Version (2.0)')).toBe('version-2-0')
      expect(slugify('Test (Beta)')).toBe('test-beta')
    })

    it('should remove brackets and braces', () => {
      expect(slugify('Guide [Updated]')).toBe('guide-updated')
      expect(slugify('Section {Advanced}')).toBe('section-advanced')
      expect(slugify('[New] Section')).toBe('new-section')
    })

    it('should handle various punctuation marks', () => {
      expect(slugify('Title; Subtitle')).toBe('title-subtitle')
      expect(slugify('One:Two')).toBe('one-two')
      expect(slugify('Forward/Backward')).toBe('forward-backward')
    })

    it('should handle ampersand', () => {
      expect(slugify('Sign & Symbol')).toBe('sign-symbol')
      expect(slugify('Frequently & Asked')).toBe('frequently-asked')
    })

    it('should handle single quotes and double quotes', () => {
      expect(slugify("It's Apostrophe")).toBe('it-s-apostrophe')
      expect(slugify('Quote "Test"')).toBe('quote-test')
    })
  })

  describe('unicode and accents', () => {
    it('should handle unicode characters with normalization potential', () => {
      // Note: The current implementation doesn't normalize accents
      // These tests document the current behavior
      expect(slugify('Café')).toContain('caf')
      expect(slugify('naïve')).toContain('na')
    })

    it('should handle emoji', () => {
      // Emoji will be stripped as non-alphanumeric
      expect(slugify('Hello 😊 World')).toBe('hello-world')
      expect(slugify('👋 Greeting')).toBe('greeting')
    })

    it('should handle non-ASCII numbers', () => {
      expect(slugify('Article #1')).toBe('article-1')
    })
  })

  describe('numbers and alphanumeric', () => {
    it('should preserve numbers', () => {
      expect(slugify('Article 1')).toBe('article-1')
      expect(slugify('Version 2.0')).toBe('version-2-0')
      expect(slugify('Item123')).toBe('item123')
    })

    it('should handle alphanumeric mixing', () => {
      expect(slugify('HTML5 Guide')).toBe('html5-guide')
      expect(slugify('CSS3 Tutorial')).toBe('css3-tutorial')
      expect(slugify('Test A2B3')).toBe('test-a2b3')
    })

    it('should handle numbers with special formatting', () => {
      expect(slugify('Version 2.0')).toBe('version-2-0')
      expect(slugify('Price: $99.99')).toBe('price-99-99')
    })
  })

  describe('camelcase and mixed case', () => {
    it('should convert CamelCase to lowercase', () => {
      expect(slugify('CamelCaseText')).toBe('camelcasetext')
      expect(slugify('camelCaseText')).toBe('camelcasetext')
      expect(slugify('HTMLParser')).toBe('htmlparser')
    })

    it('should not add hyphens between camelCase words', () => {
      // Current implementation treats camelCase as one word
      expect(slugify('myVariable')).toBe('myvariable')
      expect(slugify('getUserId')).toBe('getuserid')
    })
  })

  describe('edge cases', () => {
    it('should handle empty string', () => {
      expect(slugify('')).toBe('')
    })

    it('should handle whitespace-only string', () => {
      expect(slugify('   ')).toBe('')
      expect(slugify('\t\n')).toBe('')
    })

    it('should handle only special characters', () => {
      expect(slugify('!@#$%^&*()')).toBe('')
      expect(slugify('---')).toBe('')
    })

    it('should handle single character', () => {
      expect(slugify('A')).toBe('a')
      expect(slugify('1')).toBe('1')
    })

    it('should handle single word', () => {
      expect(slugify('Single')).toBe('single')
      expect(slugify('article')).toBe('article')
    })

    it('should handle very long text', () => {
      const longText = 'This is a very long article title that might exceed the length limit '
      const result = slugify(longText)

      expect(result.length).toBeLessThanOrEqual(200)
      expect(result).toMatch(/^[a-z0-9\-]+$/)
    })
  })

  describe('length limit (200 chars)', () => {
    it('should truncate text exceeding 200 characters', () => {
      const longText = 'a'.repeat(300)
      const result = slugify(longText)

      expect(result.length).toBeLessThanOrEqual(200)
      expect(result).toBe('a'.repeat(200))
    })

    it('should preserve length under limit', () => {
      const shortText = 'This is a short article title'
      const result = slugify(shortText)

      expect(result.length).toBeLessThanOrEqual(200)
      expect(result).toBe('this-is-a-short-article-title')
    })

    it('should truncate at exactly 200 characters if needed', () => {
      const text = 'word '.repeat(50) // Creates a string longer than 200 chars
      const result = slugify(text)

      expect(result.length).toBeLessThanOrEqual(200)
    })
  })

  describe('real-world examples', () => {
    const testCases = [
      { input: 'Getting Started', expected: 'getting-started' },
      { input: 'FAQ?', expected: 'faq' },
      { input: 'API (v2)', expected: 'api-v2' },
      { input: 'How to: Install', expected: 'how-to-install' },
      { input: 'Version 2.0 Released!', expected: 'version-2-0-released' },
      { input: 'Support & Help', expected: 'support-help' },
      { input: 'What\'s New', expected: 'what-s-new' },
      { input: 'New Feature (Beta)', expected: 'new-feature-beta' },
      { input: 'Common Issues [DRAFT]', expected: 'common-issues-draft' },
      { input: 'article title.md', expected: 'article-title-md' },
      { input: 'Email us: support@example.com', expected: 'email-us-support-example-com' },
      { input: 'Multiple   weird    spacing', expected: 'multiple-weird-spacing' },
      { input: '  trim-me  ', expected: 'trim-me' },
    ]

    testCases.forEach(({ input, expected }) => {
      it(`should convert "${input}" to "${expected}"`, () => {
        expect(slugify(input)).toBe(expected)
      })
    })
  })

  describe('consistency', () => {
    it('should be idempotent for already-slugified text', () => {
      const slugs = [
        'getting-started',
        'api-documentation',
        'frequently-asked-questions',
        'how-to-setup',
      ]

      slugs.forEach((slug) => {
        expect(slugify(slug)).toBe(slug)
      })
    })

    it('should produce same result for semantically equivalent inputs', () => {
      expect(slugify('Hello World')).toBe(slugify('hello world'))
      expect(slugify('Getting-Started')).toBe(slugify('Getting Started'))
      expect(slugify('FAQ?')).toBe(slugify('faq'))
    })

    it('should always produce lowercase output', () => {
      const inputs = [
        'UPPERCASE',
        'MixedCase',
        'lowercase',
        'SENTENCE CASE',
      ]

      inputs.forEach((input) => {
        const result = slugify(input)
        expect(result).toBe(result.toLowerCase())
      })
    })

    it('should only contain alphanumeric characters and hyphens', () => {
      const inputs = [
        'Article Title',
        'Version 2.0 (Beta)',
        'Q&A: How-to Guide',
        'Multi  Space  Test',
        'Special!Chars#Here',
      ]

      inputs.forEach((input) => {
        const result = slugify(input)
        expect(result).toMatch(/^[a-z0-9\-]*$/)
      })
    })
  })

  describe('no leading/trailing hyphens', () => {
    it('should not have leading hyphens', () => {
      const inputs = [
        '-Leading',
        '---Multiple',
        '!@# Text',
        '(Parenthesis)',
      ]

      inputs.forEach((input) => {
        const result = slugify(input)
        expect(result).not.toMatch(/^-/)
      })
    })

    it('should not have trailing hyphens', () => {
      const inputs = [
        'Trailing-',
        'Multiple---',
        'Text !@#',
        'Parenthesis)',
      ]

      inputs.forEach((input) => {
        const result = slugify(input)
        expect(result).not.toMatch(/-$/)
      })
    })
  })
})
