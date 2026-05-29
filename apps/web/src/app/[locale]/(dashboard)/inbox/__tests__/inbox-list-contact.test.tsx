/**
 * Task 31 — InboxList contact/org label fallback and org secondary line.
 *
 * Verifies:
 *  - contactName (pre-computed fullName ?? email) is used as primary label
 *  - Falls back to customerName when contactName is null
 *  - Falls back to customerEmail when contactName and customerName are null
 *  - Falls back to t('anonymous') when all name fields are null
 *  - orgName renders as a secondary line below the contact name when present
 *  - orgName secondary line is absent when orgName is null
 *
 * Component tests — no server-only imports. next-intl and @/i18n/navigation stubbed.
 */

import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, opts?: Record<string, unknown>) => {
    if (key === 'msgs' && opts) return `${opts.count} msgs`
    return key
  },
}))

vi.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...rest
  }: {
    href: string
    children: React.ReactNode
    [k: string]: unknown
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

import { InboxList } from '../InboxList'

afterEach(() => {
  cleanup()
})

const baseConv = {
  id: 'conv_1',
  status: 'ESCALATED',
  customerName: null as string | null,
  customerEmail: null as string | null,
  subject: 'Login issue',
  number: null as number | null,
  aiConfidence: null as number | null,
  escalationReason: null as string | null,
  assignedTo: null as string | null,
  firstMessage: null as string | null,
  messageCount: 3,
  contact: null as { id: string; fullName: string | null; email: string | null } | null,
  organization: null as { id: string; name: string; plan: string | null } | null,
  contactName: null as string | null,
  orgName: null as string | null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

// ── Label fallback ─────────────────────────────────────────────────────────

describe('InboxList — label fallback', () => {
  it('uses contactName (fullName) as primary label when available', () => {
    render(
      <InboxList
        escalated={[{ ...baseConv, contactName: 'Jane Smith', orgName: 'Acme' }]}
        active={[]}
        resolved={[]}
      />
    )
    expect(screen.getByText('Jane Smith')).toBeInTheDocument()
  })

  it('falls back to customerName when contactName is null', () => {
    render(
      <InboxList
        escalated={[{ ...baseConv, customerName: 'Old Name', contactName: null }]}
        active={[]}
        resolved={[]}
      />
    )
    expect(screen.getByText('Old Name')).toBeInTheDocument()
  })

  it('falls back to customerEmail when both contactName and customerName are null', () => {
    render(
      <InboxList
        escalated={[
          { ...baseConv, customerEmail: 'old@example.com', contactName: null, customerName: null },
        ]}
        active={[]}
        resolved={[]}
      />
    )
    expect(screen.getByText('old@example.com')).toBeInTheDocument()
  })

  it('falls back to "anonymous" key when all name fields are null', () => {
    render(
      <InboxList
        escalated={[
          {
            ...baseConv,
            contactName: null,
            customerName: null,
            customerEmail: null,
          },
        ]}
        active={[]}
        resolved={[]}
      />
    )
    // useTranslations stub returns key as-is
    expect(screen.getByText('anonymous')).toBeInTheDocument()
  })
})

// ── Org secondary line ──────────────────────────────────────────────────────

describe('InboxList — org secondary line', () => {
  it('renders orgName as a secondary line below the contact name', () => {
    render(
      <InboxList
        escalated={[{ ...baseConv, contactName: 'Jane Smith', orgName: 'Acme Corp' }]}
        active={[]}
        resolved={[]}
      />
    )
    expect(screen.getByText('Acme Corp')).toBeInTheDocument()
  })

  it('does not render org secondary line when orgName is null', () => {
    render(
      <InboxList
        escalated={[{ ...baseConv, contactName: 'Jane Smith', orgName: null }]}
        active={[]}
        resolved={[]}
      />
    )
    expect(screen.queryByText('Acme Corp')).not.toBeInTheDocument()
  })
})
