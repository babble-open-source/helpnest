import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HelpNest } from '../index'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function mockResponse(data: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    statusText: 'OK',
    json: () => Promise.resolve(data),
  })
}

describe('HelpNest SDK — Collections', () => {
  let client: HelpNest

  beforeEach(() => {
    mockFetch.mockReset()
    client = new HelpNest({
      apiKey: 'test-key',
      workspace: 'test-workspace',
      baseUrl: 'http://localhost:3000',
    })
  })

  it('lists collections', async () => {
    const collections = [{ id: '1', title: 'Getting Started', slug: 'getting-started' }]
    mockFetch.mockReturnValueOnce(mockResponse(collections))

    const result = await client.collections.list()
    expect(result).toEqual(collections)
  })

  it('gets a collection by slug', async () => {
    const col = { id: '1', title: 'Getting Started', slug: 'getting-started' }
    mockFetch.mockReturnValueOnce(mockResponse(col))

    const result = await client.collections.get('getting-started')
    expect(result).toEqual(col)
    const url: string = mockFetch.mock.calls[0][0] as string
    expect(url).toContain('/api/collections/getting-started')
  })

  it('creates a collection', async () => {
    const created = { id: '2', title: 'FAQ', slug: 'faq', emoji: '❓' }
    mockFetch.mockReturnValueOnce(mockResponse(created))

    const result = await client.collections.create({ title: 'FAQ', emoji: '❓' })
    expect(result).toEqual(created)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('updates a collection', async () => {
    const updated = { id: '1', title: 'Getting Started v2' }
    mockFetch.mockReturnValueOnce(mockResponse(updated))

    const result = await client.collections.update('1', { title: 'Getting Started v2' })
    expect(result).toEqual(updated)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/collections/1'),
      expect.objectContaining({ method: 'PATCH' })
    )
  })

  it('deletes a collection', async () => {
    mockFetch.mockReturnValueOnce(mockResponse({ success: true }))

    const result = await client.collections.delete('1')
    expect(result).toEqual({ success: true })
  })
})
