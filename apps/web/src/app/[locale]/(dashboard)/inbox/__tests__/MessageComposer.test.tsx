// @vitest-environment jsdom
/**
 * Task 29 — MessageComposer tabbed reply/internal-note composer.
 *
 * Covers:
 *  - mode toggle: Reply selected by default, Internal Note tab present, switching works
 *  - amber tint classes applied to textarea in note mode
 *  - payload: isInternal:false in reply mode, isInternal:true in note mode
 *  - onMessageSent callback called with returned message
 *  - textarea cleared after send
 *  - empty content does not send
 *  - Enter (without Shift) sends
 *
 * No server-only imports — MessageComposer is a pure client component.
 * fetch is stubbed globally; next-intl is mocked.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { MessageComposer } from '../[id]/MessageComposer'

const onMessageSent = vi.fn()

afterEach(() => {
  cleanup()
})

beforeEach(() => {
  vi.clearAllMocks()
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({
      message: {
        id: 'msg_1',
        role: 'AGENT',
        content: 'Hello',
        isInternal: false,
        authorMemberId: null,
        sources: null,
        confidence: null,
        feedbackHelpful: null,
        createdAt: new Date().toISOString(),
      },
    }),
  })
})

describe('MessageComposer — mode toggle', () => {
  it('renders Reply tab as selected by default', () => {
    render(
      <MessageComposer
        conversationId="conv_1"
        onMessageSent={onMessageSent}
      />,
    )
    const replyTab = screen.getByRole('tab', { name: /reply/i })
    expect(replyTab).toHaveAttribute('aria-selected', 'true')
  })

  it('renders Internal Note tab', () => {
    render(
      <MessageComposer
        conversationId="conv_1"
        onMessageSent={onMessageSent}
      />,
    )
    expect(screen.getByRole('tab', { name: /internal note/i })).toBeInTheDocument()
  })

  it('switches to note mode when Internal Note tab is clicked', async () => {
    render(
      <MessageComposer
        conversationId="conv_1"
        onMessageSent={onMessageSent}
      />,
    )
    await userEvent.click(screen.getByRole('tab', { name: /internal note/i }))
    const noteTab = screen.getByRole('tab', { name: /internal note/i })
    expect(noteTab).toHaveAttribute('aria-selected', 'true')
  })

  it('switches back to reply mode when Reply tab is clicked', async () => {
    render(
      <MessageComposer
        conversationId="conv_1"
        onMessageSent={onMessageSent}
      />,
    )
    await userEvent.click(screen.getByRole('tab', { name: /internal note/i }))
    await userEvent.click(screen.getByRole('tab', { name: /reply/i }))
    const replyTab = screen.getByRole('tab', { name: /reply/i })
    expect(replyTab).toHaveAttribute('aria-selected', 'true')
  })

  it('applies amber tint classes to textarea in note mode', async () => {
    render(
      <MessageComposer
        conversationId="conv_1"
        onMessageSent={onMessageSent}
      />,
    )
    await userEvent.click(screen.getByRole('tab', { name: /internal note/i }))
    const textarea = screen.getByRole('textbox')
    expect(textarea.className).toMatch(/bg-amber-50/)
  })
})

describe('MessageComposer — payload', () => {
  it('sends isInternal:false in reply mode', async () => {
    render(
      <MessageComposer
        conversationId="conv_1"
        onMessageSent={onMessageSent}
      />,
    )
    const textarea = screen.getByRole('textbox')
    await userEvent.type(textarea, 'Hello customer')
    await userEvent.click(screen.getByRole('button', { name: /send/i }))
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/conversations/conv_1/messages',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ content: 'Hello customer', isInternal: false }),
        }),
      )
    })
  })

  it('sends isInternal:true in note mode', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        message: {
          id: 'msg_2',
          role: 'AGENT',
          content: 'Internal note',
          isInternal: true,
          authorMemberId: null,
          sources: null,
          confidence: null,
          feedbackHelpful: null,
          createdAt: new Date().toISOString(),
        },
      }),
    })
    render(
      <MessageComposer
        conversationId="conv_1"
        onMessageSent={onMessageSent}
      />,
    )
    await userEvent.click(screen.getByRole('tab', { name: /internal note/i }))
    const textarea = screen.getByRole('textbox')
    await userEvent.type(textarea, 'Internal note')
    await userEvent.click(screen.getByRole('button', { name: /send/i }))
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/conversations/conv_1/messages',
        expect.objectContaining({
          body: JSON.stringify({ content: 'Internal note', isInternal: true }),
        }),
      )
    })
  })

  it('calls onMessageSent with the returned message', async () => {
    render(
      <MessageComposer
        conversationId="conv_1"
        onMessageSent={onMessageSent}
      />,
    )
    await userEvent.type(screen.getByRole('textbox'), 'Hello')
    await userEvent.click(screen.getByRole('button', { name: /send/i }))
    await waitFor(() => {
      expect(onMessageSent).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'msg_1', isInternal: false }),
      )
    })
  })

  it('clears the textarea after sending', async () => {
    render(
      <MessageComposer
        conversationId="conv_1"
        onMessageSent={onMessageSent}
      />,
    )
    const textarea = screen.getByRole('textbox')
    await userEvent.type(textarea, 'Hello')
    await userEvent.click(screen.getByRole('button', { name: /send/i }))
    await waitFor(() => {
      expect(textarea).toHaveValue('')
    })
  })

  it('does not send when content is empty', async () => {
    render(
      <MessageComposer
        conversationId="conv_1"
        onMessageSent={onMessageSent}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: /send/i }))
    expect(mockFetch).not.toHaveBeenCalled()
  })
})

describe('MessageComposer — keyboard', () => {
  it('sends on Enter without Shift', async () => {
    render(
      <MessageComposer
        conversationId="conv_1"
        onMessageSent={onMessageSent}
      />,
    )
    const textarea = screen.getByRole('textbox')
    await userEvent.type(textarea, 'Hello{Enter}')
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/conversations/conv_1/messages',
        expect.anything(),
      )
    })
  })
})
