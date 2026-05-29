// @vitest-environment jsdom
/**
 * Task 28 — CustomerContextPanel component tests.
 *
 * Covers:
 *  - contact-linked state: avatar initial, name, email mailto link, phone, org card
 *  - org-linked (no contact) state: org name, "No contact linked", link CTA
 *  - anonymous state: empty state + link CTA
 *  - Link contact modal: opens, searches, renders results, PATCHes + calls onContactLinked
 *
 * No server-only imports — CustomerContextPanel is a pure client component.
 * fetch is stubbed globally; next-intl and @/i18n/navigation are mocked.
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

// jsdom does not implement scrollIntoView
beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn()
  // Radix UI Dialog uses pointer-events — ensure jsdom doesn't blow up
  window.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }))
  // Radix UI uses matchMedia for some internals
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
})

// ── Stubs for next-intl ────────────────────────────────────────────────────
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useFormatter: () => ({
    dateTime: (_date: Date, _opts: unknown) => '1 Jan 12:00',
  }),
}))

// ── Stub for @/i18n/navigation ─────────────────────────────────────────────
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ refresh: vi.fn() }),
}))

// ── fetch mock ─────────────────────────────────────────────────────────────
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// Import after mocks are registered
import { CustomerContextPanel } from '../[id]/CustomerContextPanel'

const onContactLinked = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  cleanup()
})

// ──────────────────────────────────────────────────────────────────────────
// contact-linked state
// ──────────────────────────────────────────────────────────────────────────

describe('CustomerContextPanel — contact-linked state', () => {
  const contact = {
    id: 'c1',
    fullName: 'Jane Smith',
    email: 'jane@acme.com',
    phone: '+1-555-0100',
    avatarUrl: null,
    primaryOrganization: {
      id: 'o1',
      name: 'Acme Corp',
      plan: 'pro',
    },
  }

  it('renders avatar initial from fullName', () => {
    render(
      <CustomerContextPanel
        conversationId="conv_1"
        contact={contact}
        organization={null}
        onContactLinked={onContactLinked}
      />,
    )
    expect(screen.getByText('J')).toBeInTheDocument()
  })

  it('renders contact full name', () => {
    render(
      <CustomerContextPanel
        conversationId="conv_1"
        contact={contact}
        organization={null}
        onContactLinked={onContactLinked}
      />,
    )
    expect(screen.getByText('Jane Smith')).toBeInTheDocument()
  })

  it('renders email with mailto link', () => {
    render(
      <CustomerContextPanel
        conversationId="conv_1"
        contact={contact}
        organization={null}
        onContactLinked={onContactLinked}
      />,
    )
    const link = screen.getByRole('link', { name: 'jane@acme.com' })
    expect(link).toHaveAttribute('href', 'mailto:jane@acme.com')
  })

  it('renders phone number', () => {
    render(
      <CustomerContextPanel
        conversationId="conv_1"
        contact={contact}
        organization={null}
        onContactLinked={onContactLinked}
      />,
    )
    expect(screen.getByText('+1-555-0100')).toBeInTheDocument()
  })

  it('renders org card when primaryOrganization is set', () => {
    render(
      <CustomerContextPanel
        conversationId="conv_1"
        contact={contact}
        organization={null}
        onContactLinked={onContactLinked}
      />,
    )
    expect(screen.getByText('Acme Corp')).toBeInTheDocument()
    expect(screen.getByText('pro')).toBeInTheDocument()
  })

  it('does not show "Link contact" button when contact is linked', () => {
    render(
      <CustomerContextPanel
        conversationId="conv_1"
        contact={contact}
        organization={null}
        onContactLinked={onContactLinked}
      />,
    )
    expect(screen.queryByRole('button', { name: /link contact/i })).not.toBeInTheDocument()
  })
})

// ──────────────────────────────────────────────────────────────────────────
// org-linked, no contact state
// ──────────────────────────────────────────────────────────────────────────

describe('CustomerContextPanel — org-linked, no contact state', () => {
  it('renders org name and no-contact message', () => {
    render(
      <CustomerContextPanel
        conversationId="conv_1"
        contact={null}
        organization={{ id: 'o1', name: 'Acme Corp', plan: null }}
        onContactLinked={onContactLinked}
      />,
    )
    expect(screen.getByText('Acme Corp')).toBeInTheDocument()
    expect(screen.getByText(/no contact linked/i)).toBeInTheDocument()
  })

  it('shows "Link contact" button', () => {
    render(
      <CustomerContextPanel
        conversationId="conv_1"
        contact={null}
        organization={{ id: 'o1', name: 'Acme Corp', plan: null }}
        onContactLinked={onContactLinked}
      />,
    )
    expect(screen.getByRole('button', { name: /link contact/i })).toBeInTheDocument()
  })
})

// ──────────────────────────────────────────────────────────────────────────
// anonymous state
// ──────────────────────────────────────────────────────────────────────────

describe('CustomerContextPanel — anonymous state', () => {
  it('renders "No contact linked" empty state', () => {
    render(
      <CustomerContextPanel
        conversationId="conv_1"
        contact={null}
        organization={null}
        onContactLinked={onContactLinked}
      />,
    )
    expect(screen.getByText(/no contact linked/i)).toBeInTheDocument()
  })

  it('renders the "Link contact" action button', () => {
    render(
      <CustomerContextPanel
        conversationId="conv_1"
        contact={null}
        organization={null}
        onContactLinked={onContactLinked}
      />,
    )
    expect(screen.getByRole('button', { name: /link contact/i })).toBeInTheDocument()
  })
})

// ──────────────────────────────────────────────────────────────────────────
// Link contact modal
// ──────────────────────────────────────────────────────────────────────────

describe('CustomerContextPanel — Link contact modal', () => {
  beforeEach(() => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        customers: [
          { id: 'c2', fullName: 'Bob Jones', email: 'bob@beta.com' },
          { id: 'c3', fullName: null, email: 'anon@beta.com' },
        ],
      }),
    })
  })

  it('opens modal when "Link contact" is clicked', async () => {
    render(
      <CustomerContextPanel
        conversationId="conv_1"
        contact={null}
        organization={null}
        onContactLinked={onContactLinked}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: /link contact/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('calls /api/customers with search query when user types', async () => {
    render(
      <CustomerContextPanel
        conversationId="conv_1"
        contact={null}
        organization={null}
        onContactLinked={onContactLinked}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: /link contact/i }))
    const searchInput = screen.getByRole('textbox')
    await userEvent.type(searchInput, 'bob')
    await waitFor(
      () => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/customers?search=bob'),
        )
      },
      { timeout: 1000 },
    )
  })

  it('renders search results in the modal', async () => {
    render(
      <CustomerContextPanel
        conversationId="conv_1"
        contact={null}
        organization={null}
        onContactLinked={onContactLinked}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: /link contact/i }))
    const searchInput = screen.getByRole('textbox')
    await userEvent.type(searchInput, 'bob')
    await waitFor(() => {
      expect(screen.getByText('Bob Jones')).toBeInTheDocument()
    }, { timeout: 1000 })
  })

  it('PATCHes the conversation and calls onContactLinked when a result is selected', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          customers: [{ id: 'c2', fullName: 'Bob Jones', email: 'bob@beta.com' }],
        }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })

    render(
      <CustomerContextPanel
        conversationId="conv_1"
        contact={null}
        organization={null}
        onContactLinked={onContactLinked}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: /link contact/i }))
    await userEvent.type(screen.getByRole('textbox'), 'bob')
    await waitFor(() => expect(screen.getByText('Bob Jones')).toBeInTheDocument(), {
      timeout: 1000,
    })
    await userEvent.click(screen.getByText('Bob Jones'))
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/conversations/conv_1',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ contactId: 'c2' }),
        }),
      )
      expect(onContactLinked).toHaveBeenCalledWith({
        id: 'c2',
        fullName: 'Bob Jones',
        email: 'bob@beta.com',
      })
    })
  })
})
