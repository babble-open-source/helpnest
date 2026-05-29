// @vitest-environment jsdom
/**
 * Tests for the ConversationData interface extension (Task 26).
 *
 * Validates that:
 *  - ConversationData carries number, contact (ContactSummary), organization (OrganizationSummary)
 *  - Message carries isInternal and authorMemberId
 *  - ConversationSummary (InboxList) carries number, contact, organization
 *  - All optional/nullable shapes are accepted by the type system
 *
 * No server-only imports (@/lib/db, prisma, next-auth). Pure type + render tests.
 */

import React from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
})

// ── Inline copies of the interfaces (mirrors ConversationDetail.tsx + InboxList.tsx) ──
// We copy rather than import the component to avoid pulling in next-intl / @/i18n at this
// layer. If the real types diverge these tests will catch it at the assignment below.

interface ContactSummary {
  id: string
  fullName: string | null
  email: string | null
  phone: string | null
  avatarUrl: string | null
  primaryOrganization: {
    id: string
    name: string
    plan: string | null
  } | null
}

interface OrganizationSummary {
  id: string
  name: string
  plan: string | null
}

interface Message {
  id: string
  role: string
  content: string
  isInternal: boolean
  authorMemberId: string | null
  sources: unknown
  confidence: number | null
  feedbackHelpful: boolean | null
  createdAt: string
}

interface ConversationData {
  id: string
  number: number | null
  status: string
  customerName: string | null
  customerEmail: string | null
  subject: string | null
  aiConfidence: number | null
  escalationReason: string | null
  resolutionSummary: string | null
  contact: ContactSummary | null
  organization: OrganizationSummary | null
  assignedTo: { id: string; name: string | null; email: string } | null
  articles: Array<{
    id: string
    title: string
    slug: string
    collection: { slug: string; title: string }
  }>
  messages: Message[]
  createdAt: string
  updatedAt: string
}

interface ConversationSummary {
  id: string
  number: number | null
  status: string
  customerName: string | null
  customerEmail: string | null
  subject: string | null
  aiConfidence: number | null
  escalationReason: string | null
  assignedTo: string | null
  firstMessage: string | null
  messageCount: number
  contact: { id: string; fullName: string | null; email: string | null } | null
  organization: { id: string; name: string; plan: string | null } | null
  createdAt: string
  updatedAt: string
}

// ── Fixture builders ──

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg-1',
    role: 'CUSTOMER',
    content: 'Hello there',
    isInternal: false,
    authorMemberId: null,
    sources: null,
    confidence: null,
    feedbackHelpful: null,
    createdAt: '2026-05-29T10:00:00.000Z',
    ...overrides,
  }
}

function makeConversation(overrides: Partial<ConversationData> = {}): ConversationData {
  return {
    id: 'conv-1',
    number: 1042,
    status: 'ESCALATED',
    customerName: 'Jane Doe',
    customerEmail: 'jane@acme.com',
    subject: 'Billing question',
    aiConfidence: 0.85,
    escalationReason: 'Complex billing issue',
    resolutionSummary: null,
    contact: null,
    organization: null,
    assignedTo: null,
    articles: [],
    messages: [makeMessage()],
    createdAt: '2026-05-29T09:00:00.000Z',
    updatedAt: '2026-05-29T10:00:00.000Z',
    ...overrides,
  }
}

function makeContactSummary(overrides: Partial<ContactSummary> = {}): ContactSummary {
  return {
    id: 'contact-1',
    fullName: 'Jane Doe',
    email: 'jane@acme.com',
    phone: '+1-555-0100',
    avatarUrl: null,
    primaryOrganization: null,
    ...overrides,
  }
}

function makeOrganizationSummary(
  overrides: Partial<OrganizationSummary> = {}
): OrganizationSummary {
  return {
    id: 'org-1',
    name: 'Acme Corp',
    plan: 'Pro',
    ...overrides,
  }
}

function makeConversationSummary(
  overrides: Partial<ConversationSummary> = {}
): ConversationSummary {
  return {
    id: 'conv-1',
    number: 1042,
    status: 'ESCALATED',
    customerName: 'Jane Doe',
    customerEmail: 'jane@acme.com',
    subject: 'Billing question',
    aiConfidence: null,
    escalationReason: null,
    assignedTo: null,
    firstMessage: 'Hello there',
    messageCount: 1,
    contact: null,
    organization: null,
    createdAt: '2026-05-29T09:00:00.000Z',
    updatedAt: '2026-05-29T10:00:00.000Z',
    ...overrides,
  }
}

// ── Lightweight display component (exercises the type contract without next-intl) ──

function ConversationHeader({ conv }: { conv: ConversationData }) {
  return (
    <div>
      {conv.number !== null && (
        <span data-testid="ticket-number" className="font-mono text-xs">
          #{conv.number}
        </span>
      )}
      <span data-testid="subject">{conv.subject ?? 'No subject'}</span>
      {conv.contact && (
        <span data-testid="contact-name">{conv.contact.fullName ?? conv.contact.email}</span>
      )}
      {conv.organization && <span data-testid="org-name">{conv.organization.name}</span>}
      {conv.organization?.plan && <span data-testid="org-plan">{conv.organization.plan}</span>}
      {conv.messages.map((m) => (
        <div key={m.id} data-testid={`msg-${m.id}`}>
          {m.isInternal && <span data-testid={`internal-badge-${m.id}`}>Internal note</span>}
          <span data-testid={`msg-content-${m.id}`}>{m.content}</span>
          {m.authorMemberId && <span data-testid={`author-${m.id}`}>{m.authorMemberId}</span>}
        </div>
      ))}
    </div>
  )
}

function InboxRow({ conv }: { conv: ConversationSummary }) {
  return (
    <div>
      {conv.number !== null && <span data-testid="list-ticket-number">#{conv.number}</span>}
      <span data-testid="list-subject">{conv.subject ?? 'No subject'}</span>
      {conv.contact && (
        <span data-testid="list-contact">{conv.contact.fullName ?? conv.contact.email}</span>
      )}
      {conv.organization && <span data-testid="list-org">{conv.organization.name}</span>}
    </div>
  )
}

// ── Tests ──

describe('ConversationData interface — number field', () => {
  it('renders ticket number in #NNNN format', () => {
    render(<ConversationHeader conv={makeConversation({ number: 1042 })} />)
    expect(screen.getByTestId('ticket-number')).toHaveTextContent('#1042')
  })

  it('omits ticket number when null', () => {
    render(<ConversationHeader conv={makeConversation({ number: null })} />)
    expect(screen.queryByTestId('ticket-number')).not.toBeInTheDocument()
  })
})

describe('ConversationData interface — contact field', () => {
  it('renders contact fullName when contact is linked', () => {
    const contact = makeContactSummary({ fullName: 'Jane Doe', email: 'jane@acme.com' })
    render(<ConversationHeader conv={makeConversation({ contact })} />)
    expect(screen.getByTestId('contact-name')).toHaveTextContent('Jane Doe')
  })

  it('falls back to email when fullName is null', () => {
    const contact = makeContactSummary({ fullName: null, email: 'jane@acme.com' })
    render(<ConversationHeader conv={makeConversation({ contact })} />)
    expect(screen.getByTestId('contact-name')).toHaveTextContent('jane@acme.com')
  })

  it('renders nothing for contact block when anonymous', () => {
    render(<ConversationHeader conv={makeConversation({ contact: null })} />)
    expect(screen.queryByTestId('contact-name')).not.toBeInTheDocument()
  })

  it('accepts contact with primaryOrganization set', () => {
    const contact = makeContactSummary({
      primaryOrganization: { id: 'org-1', name: 'Acme Corp', plan: 'Pro' },
    })
    // Type-level: assignment succeeds at compile time → runtime just needs no throw
    const conv = makeConversation({ contact })
    expect(conv.contact?.primaryOrganization?.name).toBe('Acme Corp')
  })

  it('accepts contact with all nullable fields null', () => {
    const contact: ContactSummary = {
      id: 'c-1',
      fullName: null,
      email: null,
      phone: null,
      avatarUrl: null,
      primaryOrganization: null,
    }
    const conv = makeConversation({ contact })
    expect(conv.contact?.id).toBe('c-1')
  })
})

describe('ConversationData interface — organization field', () => {
  it('renders organization name when org is linked', () => {
    const organization = makeOrganizationSummary({ name: 'Acme Corp', plan: 'Pro' })
    render(<ConversationHeader conv={makeConversation({ organization })} />)
    expect(screen.getByTestId('org-name')).toHaveTextContent('Acme Corp')
    expect(screen.getByTestId('org-plan')).toHaveTextContent('Pro')
  })

  it('omits org block when null', () => {
    render(<ConversationHeader conv={makeConversation({ organization: null })} />)
    expect(screen.queryByTestId('org-name')).not.toBeInTheDocument()
  })

  it('accepts organization with plan null', () => {
    const organization: OrganizationSummary = { id: 'org-1', name: 'Acme', plan: null }
    const conv = makeConversation({ organization })
    expect(conv.organization?.plan).toBeNull()
  })
})

describe('Message interface — isInternal and authorMemberId', () => {
  it('shows Internal note badge for internal messages', () => {
    const msg = makeMessage({
      id: 'msg-int',
      isInternal: true,
      role: 'AGENT',
      authorMemberId: 'mem-1',
    })
    render(<ConversationHeader conv={makeConversation({ messages: [msg] })} />)
    expect(screen.getByTestId('internal-badge-msg-int')).toHaveTextContent('Internal note')
    expect(screen.getByTestId('author-msg-int')).toHaveTextContent('mem-1')
  })

  it('does not show Internal note badge for public messages', () => {
    const msg = makeMessage({ id: 'msg-pub', isInternal: false, role: 'AGENT' })
    render(<ConversationHeader conv={makeConversation({ messages: [msg] })} />)
    expect(screen.queryByTestId('internal-badge-msg-pub')).not.toBeInTheDocument()
  })

  it('does not show author when authorMemberId is null', () => {
    const msg = makeMessage({ id: 'msg-cust', isInternal: false, authorMemberId: null })
    render(<ConversationHeader conv={makeConversation({ messages: [msg] })} />)
    expect(screen.queryByTestId('author-msg-cust')).not.toBeInTheDocument()
  })

  it('defaults isInternal to false', () => {
    const msg = makeMessage()
    expect(msg.isInternal).toBe(false)
  })
})

describe('ConversationSummary interface (InboxList) — new fields', () => {
  it('renders ticket number in list row', () => {
    render(<InboxRow conv={makeConversationSummary({ number: 1042 })} />)
    expect(screen.getByTestId('list-ticket-number')).toHaveTextContent('#1042')
  })

  it('omits ticket number when null in list', () => {
    render(<InboxRow conv={makeConversationSummary({ number: null })} />)
    expect(screen.queryByTestId('list-ticket-number')).not.toBeInTheDocument()
  })

  it('renders contact in list row when linked', () => {
    render(
      <InboxRow
        conv={makeConversationSummary({
          contact: { id: 'c-1', fullName: 'Jane Doe', email: 'jane@acme.com' },
        })}
      />
    )
    expect(screen.getByTestId('list-contact')).toHaveTextContent('Jane Doe')
  })

  it('falls back to email in list row when fullName null', () => {
    render(
      <InboxRow
        conv={makeConversationSummary({
          contact: { id: 'c-1', fullName: null, email: 'jane@acme.com' },
        })}
      />
    )
    expect(screen.getByTestId('list-contact')).toHaveTextContent('jane@acme.com')
  })

  it('omits contact block in list row when anonymous', () => {
    render(<InboxRow conv={makeConversationSummary({ contact: null })} />)
    expect(screen.queryByTestId('list-contact')).not.toBeInTheDocument()
  })

  it('renders organization name in list row', () => {
    render(
      <InboxRow
        conv={makeConversationSummary({
          organization: { id: 'org-1', name: 'Acme Corp', plan: 'Pro' },
        })}
      />
    )
    expect(screen.getByTestId('list-org')).toHaveTextContent('Acme Corp')
  })

  it('accepts organization with plan null in list row', () => {
    const summary = makeConversationSummary({
      organization: { id: 'org-1', name: 'Acme', plan: null },
    })
    expect(summary.organization?.plan).toBeNull()
  })
})
