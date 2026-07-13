// @vitest-environment jsdom
/**
 * Markdown rendering in the message thread.
 *
 * AI and agent messages are authored in Markdown (the AI agent emits **bold**,
 * numbered lists, and pseudo-citation links like [title](2)); they must render
 * through a markdown renderer, not as raw text. Covers:
 *  - bold/list markdown rendered as elements, raw ** markers absent
 *  - real http(s) links render as anchors with safe target/rel
 *  - non-navigable hrefs (the AI's "[title](2)" citation artifact) render as
 *    plain text, never as a broken relative link
 *  - customer messages stay plain text (markdown NOT interpreted)
 *
 * No server-only imports — ConversationDetail is a pure client component.
 */

import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import React from 'react'

beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn()
})

afterEach(() => {
  cleanup()
})

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useFormatter: () => ({
    dateTime: (_date: Date) => '1 Jan 12:00',
  }),
}))
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ refresh: vi.fn() }),
}))
vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}))

import { ConversationDetail } from '../[id]/ConversationDetail'

const baseConversation = {
  id: 'conv_1',
  number: null,
  status: 'AI_ACTIVE',
  customerName: 'Jane',
  customerEmail: null,
  subject: 'Voice question',
  aiConfidence: null,
  escalationReason: null,
  resolutionSummary: null,
  contact: null,
  organization: null,
  assignedTo: null,
  articles: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

function message(overrides: Record<string, unknown>) {
  return {
    id: 'msg_1',
    role: 'AI',
    content: '',
    isInternal: false,
    authorMemberId: null,
    sources: null,
    confidence: null,
    retrievalMode: null,
    retrievalScore: null,
    reportedConfidence: null,
    retrievalDegraded: null,
    feedbackHelpful: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

const members = [{ id: 'm1', name: 'Agent', email: 'agent@co.com' }]

function renderWithMessages(messages: ReturnType<typeof message>[]) {
  return render(
    <ConversationDetail
      conversation={{ ...baseConversation, messages }}
      members={members}
      currentMemberId="m1"
    />
  )
}

describe('Markdown message rendering', () => {
  it('renders bold markdown in AI messages as <strong>, without raw ** markers', () => {
    renderWithMessages([message({ content: 'Click **Edit Configuration** to begin.' })])

    const strong = screen.getByText('Edit Configuration')
    expect(strong.tagName).toBe('STRONG')
    expect(screen.queryByText(/\*\*/)).toBeNull()
  })

  it('renders ordered lists in AI messages as list items', () => {
    renderWithMessages([
      message({ content: '1. Access the agent\n2. Edit configuration\n3. Select voice' }),
    ])

    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(3)
    expect(items[0]).toHaveTextContent('Access the agent')
  })

  it('renders http(s) links as anchors with safe target and rel', () => {
    renderWithMessages([message({ content: 'See [the docs](https://example.com/docs) for more.' })])

    const anchor = screen.getByRole('link', { name: 'the docs' })
    expect(anchor).toHaveAttribute('href', 'https://example.com/docs')
    expect(anchor).toHaveAttribute('target', '_blank')
    expect(anchor.getAttribute('rel')).toMatch(/noopener/)
  })

  it('renders AI citation artifacts like [title](2) as plain text, not a link', () => {
    renderWithMessages([message({ content: 'Check the article on [editing a live agent](2).' })])

    const citation = screen.getByText('editing a live agent')
    expect(citation.closest('a')).toBeNull()
    expect(screen.queryByRole('link', { name: 'editing a live agent' })).toBeNull()
  })

  it('renders markdown for agent replies too', () => {
    renderWithMessages([
      message({ id: 'msg_a', role: 'AGENT', content: 'Fixed — see **release notes**.' }),
    ])

    expect(screen.getByText('release notes').tagName).toBe('STRONG')
  })

  it('does NOT interpret markdown in customer messages', () => {
    renderWithMessages([
      message({ id: 'msg_c', role: 'CUSTOMER', content: 'My password has ** in it **really**' }),
    ])

    expect(screen.getByText('My password has ** in it **really**')).toBeInTheDocument()
    expect(screen.queryByRole('strong')).toBeNull()
  })
})
