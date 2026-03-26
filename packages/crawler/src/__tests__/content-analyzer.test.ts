import { describe, it, expect } from 'vitest'
import { analyzeContent } from '../content-analyzer'

describe('analyzeContent', () => {
  describe('classifyContentType', () => {
    it('classifies FAQ-like content as docs', () => {
      const result = analyzeContent(
        '# FAQ\n\n## How do I reset my password?\n\nGo to settings and click reset.',
        'https://example.com/faq'
      )
      expect(result.contentType).toBe('docs')
    })

    it('classifies content with pricing keywords as marketing', () => {
      const result = analyzeContent(
        '# Pricing\n\nOur starter plan is $9/mo. Enterprise plan includes SSO.',
        'https://example.com/pricing'
      )
      expect(result.contentType).toBe('marketing')
    })

    it('classifies content with feature descriptions as marketing', () => {
      const result = analyzeContent(
        '# Features\n\nReal-time collaboration. AI-powered insights. Unlimited storage.',
        'https://example.com/features'
      )
      expect(result.contentType).toBe('marketing')
    })

    it('classifies how-to content as docs', () => {
      const result = analyzeContent(
        '# How to Configure Webhooks\n\n1. Navigate to Settings\n2. Click Webhooks\n3. Add endpoint URL',
        'https://example.com/docs/webhooks'
      )
      expect(result.contentType).toBe('docs')
    })

    it('classifies generic content as other', () => {
      const result = analyzeContent(
        'Lorem ipsum dolor sit amet.',
        'https://example.com/about'
      )
      expect(result.contentType).toBe('other')
    })
  })

  describe('sensitive data detection', () => {
    it('detects email addresses', () => {
      const result = analyzeContent(
        '# Support\n\nContact us at admin@example.com for help.',
        'https://example.com/support'
      )
      expect(result.sensitiveDataWarnings).toContain('Email addresses detected')
    })

    it('detects API key patterns', () => {
      const result = analyzeContent(
        '# Settings\n\nYour API key: sk-1234567890abcdef1234567890abcdef',
        'https://example.com/settings'
      )
      expect(result.sensitiveDataWarnings).toContain('Possible API keys detected')
    })

    it('detects IP addresses', () => {
      const result = analyzeContent(
        '# Config\n\nConnect to database at 54.23.123.45:5432',
        'https://example.com/config'
      )
      expect(result.sensitiveDataWarnings).toContain('IP addresses detected')
    })

    it('returns empty warnings for clean content', () => {
      const result = analyzeContent(
        '# Getting Started\n\nWelcome to our product. Click the button to begin.',
        'https://example.com/start'
      )
      expect(result.sensitiveDataWarnings).toEqual([])
    })
  })

  describe('content quality', () => {
    it('flags content that is too short', () => {
      const result = analyzeContent('Hi', 'https://example.com')
      expect(result.tooShort).toBe(true)
    })

    it('does not flag content with sufficient length', () => {
      const result = analyzeContent(
        '# Guide\n\nThis is a comprehensive guide to getting started with our platform. It covers all the basics you need to know.',
        'https://example.com/guide'
      )
      expect(result.tooShort).toBe(false)
    })
  })
})
