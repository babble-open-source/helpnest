/**
 * The human agent must be able to see WHAT the AI answered from.
 *
 * Retrieval similarity measures whether an article is about the question, not
 * whether it is correct or current — so a stale-but-on-topic article scores high
 * and passes the escalation gate. No automated signal catches that. The only thing
 * that does is a human noticing the source link, which means the source has to be
 * on screen.
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import en from '@/messages/en.json'

// Only the locale-aware Link is stubbed — next-intl itself stays real so these
// assertions run against the actual en.json strings. A missing or renamed
// translation key then fails the test instead of silently echoing the key name.
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

import { MessageGrounding } from '../[id]/MessageGrounding'

function renderGrounding(props: Partial<Parameters<typeof MessageGrounding>[0]> = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <MessageGrounding
        sources={null}
        confidence={null}
        retrievalMode={null}
        retrievalScore={null}
        reportedConfidence={null}
        retrievalDegraded={null}
        {...props}
      />
    </NextIntlClientProvider>
  )
}

// Explicit cleanup rather than relying on Testing Library's auto-cleanup: in the
// full suite another file's setup wins and the DOM leaks between cases, so a
// previous test's markup was still on screen when the next one queried it.
afterEach(cleanup)

const source = (id: string, title: string) => ({
  id,
  title,
  slug: title.toLowerCase().replace(/\s+/g, '-'),
  collection: { slug: 'general', title: 'General' },
})

describe('MessageGrounding', () => {
  it('names the articles the answer came from, and links to each', () => {
    renderGrounding({
      sources: [source('a1', 'Resetting your password')],
      confidence: 0.8,
      retrievalMode: 'vector',
      retrievalScore: 0.62,
    })

    const link = screen.getByRole('link', { name: /Resetting your password/ })
    expect(link).toHaveAttribute('href', expect.stringContaining('/articles/a1/edit'))
  })

  it('separates what retrieval measured from what the model claimed', () => {
    // A single blended number cannot tell an agent whether a weak answer came from
    // a thin knowledge base or from a hesitant model — opposite fixes.
    renderGrounding({
      sources: [source('a1', 'Billing FAQ')],
      confidence: 0.4,
      retrievalMode: 'vector',
      retrievalScore: 0.55,
      reportedConfidence: 0.4,
    })

    expect(screen.getByText(/Best article match 55%/)).toBeInTheDocument()
    expect(screen.getByText(/AI self-rated 40%/)).toBeInTheDocument()
  })

  it('says so when the answer ran on keyword overlap instead of vector search', () => {
    renderGrounding({
      sources: [source('a1', 'Billing FAQ')],
      confidence: 0.5,
      retrievalMode: 'lexical',
      retrievalScore: 0.5,
    })

    expect(screen.getByText(/Keyword coverage 50%/)).toBeInTheDocument()
  })

  it('warns the agent when the vector store was down for this answer', () => {
    renderGrounding({
      sources: [source('a1', 'Billing FAQ')],
      confidence: 0.5,
      retrievalMode: 'lexical',
      retrievalScore: 0.5,
      retrievalDegraded: true,
    })

    expect(screen.getByText(/Vector search was unavailable/)).toBeInTheDocument()
  })

  it('does not warn when the vector store was healthy', () => {
    renderGrounding({
      sources: [source('a1', 'Billing FAQ')],
      confidence: 0.9,
      retrievalMode: 'vector',
      retrievalScore: 0.7,
      retrievalDegraded: false,
    })

    expect(screen.queryByText(/Vector search was unavailable/)).not.toBeInTheDocument()
  })

  it('reports when the agent searched and found nothing', () => {
    renderGrounding({ sources: [], confidence: 0, retrievalMode: 'none', retrievalScore: null })

    expect(screen.getByText(/No matching articles were found/)).toBeInTheDocument()
  })

  it('renders nothing for a greeting the agent never searched on', () => {
    // null confidence + no sources = there was no question to ground. Showing a
    // grounding panel here would imply a judgement that was never made.
    const { container } = renderGrounding({ sources: null, confidence: null })

    expect(container).toBeEmptyDOMElement()
  })

  it('survives a malformed sources column without blanking the conversation', () => {
    const { container } = renderGrounding({
      sources: { not: 'an array' },
      confidence: 0.8,
      retrievalMode: 'vector',
      retrievalScore: 0.6,
    })

    expect(container).not.toBeEmptyDOMElement()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})
