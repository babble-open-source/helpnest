// @vitest-environment jsdom
/**
 * Task 27 — Ticket number display in ConversationDetail header and InboxList rows.
 *
 * Verifies:
 *  - ConversationDetail renders `#<number>` with font-mono text-xs when number is set
 *  - ConversationDetail renders nothing matching #\d+ when number is null
 *  - InboxList rows render `#<number>` with font-mono text-xs when number is set
 *  - InboxList rows render nothing matching #\d+ when number is null
 *
 * No server-only imports — ConversationDetail and InboxList are client components.
 * next-intl and @/i18n/navigation are stubbed to avoid ESM/node boundary issues.
 */

import React from 'react'
import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// jsdom does not implement scrollIntoView — mock it globally so ConversationDetail's
// useEffect (which calls messagesEndRef.current?.scrollIntoView) doesn't throw.
beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn()
})

// ── Stubs for next-intl (used by both components) ──────────────────────────
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useFormatter: () => ({
    dateTime: (_date: Date, _opts: unknown) => '1 Jan 12:00',
  }),
}))

// ── Stub for @/i18n/navigation (Link + useRouter used in ConversationDetail) ──
vi.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...rest
  }: {
    href: string
    children: React.ReactNode
    [k: string]: unknown
  }) => <a href={href} {...rest}>{children}</a>,
  useRouter: () => ({ refresh: vi.fn() }),
}))

import { ConversationDetail } from '../[id]/ConversationDetail'
import { InboxList } from '../InboxList'

afterEach(() => {
  cleanup()
})

// ── Shared fixtures ────────────────────────────────────────────────────────

const baseConversation = {
  id: 'conv_1',
  number: null as number | null,
  status: 'ACTIVE',
  customerName: 'Jane Smith',
  customerEmail: 'jane@acme.com',
  subject: 'Help with login',
  aiConfidence: null,
  escalationReason: null,
  resolutionSummary: null,
  contact: null,
  organization: null,
  assignedTo: null,
  articles: [],
  messages: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const baseMembers = [{ id: 'm1', name: 'Agent One', email: 'agent@acme.com' }]

const baseConvSummary = {
  id: 'conv_1',
  number: null as number | null,
  status: 'ACTIVE',
  customerName: 'Jane Smith',
  customerEmail: 'jane@acme.com',
  subject: 'Help with login',
  aiConfidence: null,
  escalationReason: null,
  assignedTo: null,
  firstMessage: 'Hello, I need help',
  messageCount: 3,
  contact: null,
  organization: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

// ── ConversationDetail ─────────────────────────────────────────────────────

describe('ConversationDetail — ticket number in header', () => {
  it('renders #1042 with font-mono text-xs when number is set', () => {
    render(
      <ConversationDetail
        conversation={{ ...baseConversation, number: 1042 }}
        members={baseMembers}
        currentMemberId="m1"
      />,
    )
    const el = screen.getByText('#1042')
    expect(el).toBeInTheDocument()
    expect(el.className).toMatch(/font-mono/)
    expect(el.className).toMatch(/text-xs/)
  })

  it('does not render a ticket number element when number is null', () => {
    render(
      <ConversationDetail
        conversation={{ ...baseConversation, number: null }}
        members={baseMembers}
        currentMemberId="m1"
      />,
    )
    expect(screen.queryByText(/^#\d+$/)).not.toBeInTheDocument()
  })
})

// ── InboxList ──────────────────────────────────────────────────────────────

describe('InboxList — ticket number in rows', () => {
  it('renders #2077 with font-mono text-xs in an active conversation row', async () => {
    const user = userEvent.setup()
    render(
      <InboxList
        escalated={[]}
        active={[{ ...baseConvSummary, id: 'conv_2', number: 2077 }]}
        resolved={[]}
      />,
    )
    // Switch to active tab — the component defaults to "escalated" but active is visible via tab
    const activeTab = screen.getByRole('tab', { name: /active/i })
    await user.click(activeTab)
    const el = screen.getByText('#2077')
    expect(el).toBeInTheDocument()
    expect(el.className).toMatch(/font-mono/)
    expect(el.className).toMatch(/text-xs/)
  })

  it('does not render a ticket number element in a row when number is null', async () => {
    const user = userEvent.setup()
    render(
      <InboxList
        escalated={[]}
        active={[{ ...baseConvSummary, id: 'conv_3', number: null }]}
        resolved={[]}
      />,
    )
    const activeTab = screen.getByRole('tab', { name: /active/i })
    await user.click(activeTab)
    expect(screen.queryByText(/^#\d+$/)).not.toBeInTheDocument()
  })

  it('renders ticket number in escalated tab when conv is escalated', async () => {
    render(
      <InboxList
        escalated={[
          {
            ...baseConvSummary,
            id: 'conv_4',
            number: 101,
            status: 'ESCALATED',
            escalationReason: 'Complex issue',
          },
        ]}
        active={[]}
        resolved={[]}
      />,
    )
    // Default tab is "escalated" — no click needed
    const el = screen.getByText('#101')
    expect(el).toBeInTheDocument()
    expect(el.className).toMatch(/font-mono/)
    expect(el.className).toMatch(/text-xs/)
  })
})
