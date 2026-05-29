// @vitest-environment jsdom
/**
 * Task 30 — Internal-note rendering in the message thread.
 *
 * Covers:
 *  - "Internal note" text label present for isInternal messages (a11y: text, not color alone)
 *  - lock icon is aria-hidden (the visible text label is the accessible identifier,
 *    not the icon — a duplicate aria-label on the icon would cause double-announcement)
 *  - amber bubble classes (bg-amber-50, border-amber-200) applied to isInternal bubbles
 *  - amber classes NOT applied to regular agent replies
 *  - "Internal note" label NOT rendered for public agent messages
 *  - both public and internal messages render correctly in the same thread
 *
 * No server-only imports — ConversationDetail is a pure client component.
 * fetch and router are stubbed; next-intl and @/i18n/navigation are mocked.
 */

import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import React from 'react'

// jsdom does not implement scrollIntoView — mock it globally so ConversationDetail's
// useEffect (which calls messagesEndRef.current?.scrollIntoView) doesn't throw.
beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn()
})

// Unmount components after each test so DOM doesn't accumulate across tests.
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
// Radix ScrollArea renders content inside a viewport element that can cause duplicate
// DOM nodes in jsdom. Replace with a simple passthrough so assertions remain 1:1.
vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}))

import { ConversationDetail } from '../[id]/ConversationDetail'

const baseConversation = {
  id: 'conv_1',
  number: null,
  status: 'HUMAN_ACTIVE',
  customerName: 'Jane',
  customerEmail: null,
  subject: 'Login issue',
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

const agentPublicMessage = {
  id: 'msg_pub',
  role: 'AGENT',
  content: 'Hi, let me look into this.',
  isInternal: false,
  authorMemberId: null,
  sources: null,
  confidence: null,
  feedbackHelpful: null,
  createdAt: new Date().toISOString(),
}

const internalNoteMessage = {
  id: 'msg_int',
  role: 'AGENT',
  content: 'Customer seems frustrated.',
  isInternal: true,
  authorMemberId: null,
  sources: null,
  confidence: null,
  feedbackHelpful: null,
  createdAt: new Date().toISOString(),
}

const members = [{ id: 'm1', name: 'Agent', email: 'agent@co.com' }]

describe('Internal note rendering', () => {
  it('renders the "Internal note" text label for isInternal messages', () => {
    render(
      <ConversationDetail
        conversation={{ ...baseConversation, messages: [internalNoteMessage] }}
        members={members}
        currentMemberId="m1"
      />
    )
    expect(screen.getByText('Internal note')).toBeInTheDocument()
  })

  it('renders the lock icon as aria-hidden (visible text label is the a11y identifier)', () => {
    // The lock SVG must be aria-hidden="true" so screen readers do not announce
    // it. The adjacent <p> text "Internal note" is the sole accessible label.
    // A duplicate aria-label on the icon wrapper would cause double-announcement.
    const { container } = render(
      <ConversationDetail
        conversation={{ ...baseConversation, messages: [internalNoteMessage] }}
        members={members}
        currentMemberId="m1"
      />
    )
    const lockSvg = container.querySelector('svg[aria-hidden="true"]')
    expect(lockSvg).not.toBeNull()
    // No element should carry aria-label="Internal note" (that was the bug).
    expect(container.querySelector('[aria-label="Internal note"]')).toBeNull()
  })

  it('applies amber bubble classes to isInternal message', () => {
    render(
      <ConversationDetail
        conversation={{ ...baseConversation, messages: [internalNoteMessage] }}
        members={members}
        currentMemberId="m1"
      />
    )
    const bubble = screen.getByText('Customer seems frustrated.').closest('div')
    expect(bubble?.className).toMatch(/bg-amber-50/)
    expect(bubble?.className).toMatch(/border-amber-200/)
  })

  it('does NOT apply amber classes to a regular agent reply', () => {
    render(
      <ConversationDetail
        conversation={{ ...baseConversation, messages: [agentPublicMessage] }}
        members={members}
        currentMemberId="m1"
      />
    )
    const bubble = screen.getByText('Hi, let me look into this.').closest('div')
    expect(bubble?.className).not.toMatch(/bg-amber-50/)
  })

  it('does not render "Internal note" label for a public agent message', () => {
    render(
      <ConversationDetail
        conversation={{ ...baseConversation, messages: [agentPublicMessage] }}
        members={members}
        currentMemberId="m1"
      />
    )
    expect(screen.queryByText('Internal note')).not.toBeInTheDocument()
  })

  it('renders both public agent and internal note messages in the same thread', () => {
    render(
      <ConversationDetail
        conversation={{
          ...baseConversation,
          messages: [agentPublicMessage, internalNoteMessage],
        }}
        members={members}
        currentMemberId="m1"
      />
    )
    expect(screen.getByText('Hi, let me look into this.')).toBeInTheDocument()
    expect(screen.getByText('Customer seems frustrated.')).toBeInTheDocument()
    expect(screen.getByText('Internal note')).toBeInTheDocument()
  })
})
