import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchPage } from '../page-fetcher'

// Mock playwright-core
vi.mock('playwright-core', () => {
  const mockPage = {
    goto: vi.fn(),
    content: vi.fn(),
    title: vi.fn(),
    close: vi.fn(),
    waitForLoadState: vi.fn(),
  }
  const mockContext = {
    newPage: vi.fn(() => mockPage),
    close: vi.fn(),
  }
  const mockBrowser = {
    newContext: vi.fn(() => mockContext),
    close: vi.fn(),
  }
  return {
    chromium: {
      launch: vi.fn(() => mockBrowser),
    },
    _mockPage: mockPage,
    _mockBrowser: mockBrowser,
    _mockContext: mockContext,
  }
})

describe('fetchPage', () => {
  let mockPage: any
  let mockBrowser: any

  beforeEach(async () => {
    const pw = await import('playwright-core')
    mockPage = (pw as any)._mockPage
    mockBrowser = (pw as any)._mockBrowser
    vi.clearAllMocks()
  })

  it('returns HTML content from a successful page load', async () => {
    mockPage.goto.mockResolvedValue(undefined)
    mockPage.waitForLoadState.mockResolvedValue(undefined)
    mockPage.content.mockResolvedValue('<html><body><h1>Hello</h1></body></html>')
    mockPage.title.mockResolvedValue('Hello Page')

    const result = await fetchPage('https://example.com')
    expect(result.html).toContain('<h1>Hello</h1>')
    expect(result.error).toBeNull()
  })

  it('returns an error when page load fails', async () => {
    mockPage.goto.mockRejectedValue(new Error('net::ERR_NAME_NOT_RESOLVED'))

    const result = await fetchPage('https://nonexistent.invalid')
    expect(result.html).toBeNull()
    expect(result.error).toContain('net::ERR_NAME_NOT_RESOLVED')
  })

  it('closes browser after fetching', async () => {
    mockPage.goto.mockResolvedValue(undefined)
    mockPage.waitForLoadState.mockResolvedValue(undefined)
    mockPage.content.mockResolvedValue('<html></html>')
    mockPage.title.mockResolvedValue('')

    await fetchPage('https://example.com')
    expect(mockBrowser.close).toHaveBeenCalled()
  })

  it('closes browser even on error', async () => {
    mockPage.goto.mockRejectedValue(new Error('timeout'))

    await fetchPage('https://example.com')
    expect(mockBrowser.close).toHaveBeenCalled()
  })
})
