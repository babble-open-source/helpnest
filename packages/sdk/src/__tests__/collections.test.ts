import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HelpNest } from '../index'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function mockResponse(data: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: { get: () => null },
    json: () => Promise.resolve(data),
  })
}

function mockEmptyResponse(status = 204) {
  return Promise.resolve({
    ok: true,
    status,
    statusText: 'No Content',
    headers: { get: (h: string) => (h === 'content-length' ? '0' : null) },
    json: () => Promise.reject(new SyntaxError('No body')),
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

  it('lists collections and returns paginated response', async () => {
    const data = [{ id: '1', title: 'Getting Started', slug: 'getting-started' }]
    mockFetch.mockReturnValueOnce(mockResponse({ data, total: 1 }))

    const result = await client.collections.list()
    expect(result.data).toEqual(data)
    expect(result.total).toBe(1)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/collections'),
      expect.objectContaining({ method: 'GET' })
    )
  })

  it('passes filter params as query string', async () => {
    mockFetch.mockReturnValueOnce(mockResponse({ data: [], total: 0 }))

    await client.collections.list({ isPublic: true })

    const url: string = mockFetch.mock.calls[0][0] as string
    expect(url).toContain('isPublic=true')
  })

  it('gets a collection by id or slug', async () => {
    const col = { id: '1', title: 'Getting Started', slug: 'getting-started' }
    mockFetch.mockReturnValueOnce(mockResponse(col))

    const result = await client.collections.get('getting-started')
    expect(result).toEqual(col)
    const url: string = mockFetch.mock.calls[0][0] as string
    expect(url).toContain('/api/collections/getting-started')
  })

  it('creates a collection', async () => {
    const created = { id: '2', title: 'FAQ', slug: 'faq', emoji: '❓' }
    mockFetch.mockReturnValueOnce(mockResponse(created, 201))

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

  it('deletes a collection and handles 204 No Content', async () => {
    mockFetch.mockReturnValueOnce(mockEmptyResponse(204))

    const result = await client.collections.delete('1')
    expect(result).toEqual({ success: true })
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/collections/1'),
      expect.objectContaining({ method: 'DELETE' })
    )
  })

  it('sends Authorization header on every request', async () => {
    mockFetch.mockReturnValueOnce(mockResponse({ data: [], total: 0 }))

    await client.collections.list()

    expect(mockFetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer test-key' }),
      })
    )
  })

  it('throws HelpNestError on 4xx', async () => {
    mockFetch.mockReturnValueOnce(mockResponse({ error: 'Not found' }, 404))

    const { HelpNestError } = await import('../index')
    await expect(client.collections.get('nonexistent')).rejects.toThrow(HelpNestError)
  })
})
