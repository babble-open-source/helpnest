import { describe, it, expect } from 'vitest'
import { buildArticlePrompt, parseArticleResponse, buildGoalPrompt } from '../article-generator'
import type { GoalPromptInput } from '../types'

describe('buildArticlePrompt', () => {
  it('builds a system prompt for marketing content', () => {
    const result = buildArticlePrompt({
      markdown: '# Features\n\nReal-time sync across devices.',
      title: 'Features',
      url: 'https://acme.com/features',
      contentType: 'marketing',
      workspaceName: 'Acme',
      existingCollections: ['Getting Started', 'FAQ'],
    })
    expect(result.system).toContain('help article')
    expect(result.system).toContain('Acme')
    expect(result.userMessage).toContain('Features')
    expect(result.userMessage).toContain('Real-time sync')
  })

  it('builds a system prompt for docs content', () => {
    const result = buildArticlePrompt({
      markdown: '# How to Reset Password\n\n1. Go to settings\n2. Click reset',
      title: 'How to Reset Password',
      url: 'https://acme.com/docs/reset',
      contentType: 'docs',
      workspaceName: 'Acme',
      existingCollections: [],
    })
    expect(result.system).toContain('restructure')
    expect(result.userMessage).toContain('How to Reset Password')
  })

  it('includes existing collection names in the prompt', () => {
    const result = buildArticlePrompt({
      markdown: '# Test',
      title: 'Test',
      url: 'https://acme.com/test',
      contentType: 'other',
      workspaceName: 'Acme',
      existingCollections: ['Getting Started', 'API Reference'],
    })
    expect(result.system).toContain('Getting Started')
    expect(result.system).toContain('API Reference')
  })
})

describe('parseArticleResponse', () => {
  it('parses a well-formed JSON response', () => {
    const raw = JSON.stringify({
      title: 'Getting Started with Acme',
      content: '# Getting Started\n\nWelcome to Acme.',
      excerpt: 'Learn how to get started with Acme.',
      suggestedCollection: 'Getting Started',
      confidence: 0.85,
    })
    const result = parseArticleResponse(raw)
    expect(result.title).toBe('Getting Started with Acme')
    expect(result.content).toContain('Welcome to Acme')
    expect(result.confidence).toBe(0.85)
  })

  it('extracts JSON from markdown code block', () => {
    const raw = 'Here is the article:\n```json\n{"title":"Test","content":"Content","excerpt":"Exc","suggestedCollection":null,"confidence":0.7}\n```'
    const result = parseArticleResponse(raw)
    expect(result.title).toBe('Test')
    expect(result.confidence).toBe(0.7)
  })

  it('returns fallback for unparseable response', () => {
    const raw = 'This is not JSON at all, just random text'
    const result = parseArticleResponse(raw)
    expect(result.title).toBe('Untitled Article')
    expect(result.content).toBe(raw)
    expect(result.confidence).toBe(0.3)
  })

  it('clamps confidence between 0 and 1', () => {
    const raw = JSON.stringify({
      title: 'Test',
      content: 'Content',
      excerpt: 'Exc',
      suggestedCollection: null,
      confidence: 5.0,
    })
    const result = parseArticleResponse(raw)
    expect(result.confidence).toBe(1.0)
  })
})

describe('buildGoalPrompt', () => {
  it('includes the goal in the system prompt', () => {
    const input: GoalPromptInput = {
      markdown: '# Settings\n\nManage your team here.',
      title: 'Settings',
      url: 'https://acme.com/settings',
      contentType: 'app-ui',
      workspaceName: 'Acme',
      existingCollections: [],
      goal: 'How to invite team members and set roles',
    }
    const result = buildGoalPrompt(input)
    expect(result.system).toContain('invite team members')
    expect(result.system).toContain('Acme')
  })

  it('includes series context when provided', () => {
    const input: GoalPromptInput = {
      markdown: '# Roles\n\nAdmin, Editor, Viewer.',
      title: 'Roles',
      url: 'https://acme.com/settings/roles',
      contentType: 'app-ui',
      workspaceName: 'Acme',
      existingCollections: ['Team Management'],
      goal: 'How to manage team roles',
      seriesContext: {
        articleNumber: 2,
        totalArticles: 3,
        previousTitles: ['How to Invite Team Members'],
      },
    }
    const result = buildGoalPrompt(input)
    expect(result.system).toContain('article 2 of 3')
    expect(result.system).toContain('How to Invite Team Members')
    expect(result.system).toContain('without repeating')
  })

  it('works without series context (single article)', () => {
    const input: GoalPromptInput = {
      markdown: '# Billing\n\nUpgrade your plan.',
      title: 'Billing',
      url: 'https://acme.com/billing',
      contentType: 'marketing',
      workspaceName: 'Acme',
      existingCollections: [],
      goal: 'How billing and pricing works',
    }
    const result = buildGoalPrompt(input)
    expect(result.system).toContain('billing and pricing')
    expect(result.system).not.toMatch(/article \d+ of \d+/)
    expect(result.system).not.toContain('series')
  })
})
