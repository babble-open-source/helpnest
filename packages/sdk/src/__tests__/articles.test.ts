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

describe('HelpNest SDK — Articles', () => {
  let client: HelpNest

  beforeEach(() => {
    mockFetch.mockReset()
    client = new HelpNest({
      apiKey: 'test-key',
      workspace: 'test-workspace',
      baseUrl: 'http://localhost:3000',
    })
  })

  it('lists articles and returns paginated response', async () => {
    const data = [{ id: '1', title: 'Hello', slug: 'hello' }]
    mockFetch.mockReturnValueOnce(mockResponse({ data, total: 1 }))

    const result = await client.articles.list()
    expect(result.data).toEqual(data)
    expect(result.total).toBe(1)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/articles'),
      expect.objectContaining({ method: 'GET' })
    )
  })

  it('passes status filter as query param', async () => {
    mockFetch.mockReturnValueOnce(mockResponse({ data: [], total: 0 }))

    await client.articles.list({ status: 'PUBLISHED' })

    const url: string = mockFetch.mock.calls[0][0] as string
    expect(url).toContain('status=PUBLISHED')
  })

  it('gets an article by slug', async () => {
    const article = { id: '1', title: 'Hello', slug: 'hello' }
    mockFetch.mockReturnValueOnce(mockResponse(article))

    const result = await client.articles.get('hello')
    expect(result).toEqual(article)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/articles/hello'),
      expect.anything()
    )
  })

  it('creates an article with full params', async () => {
    const created = { id: '2', title: 'New Article', slug: 'new-article', status: 'DRAFT' }
    mockFetch.mockReturnValueOnce(mockResponse(created, 201))

    const result = await client.articles.create({
      title: 'New Article',
      content: '<p>Hello</p>',
      collectionId: 'col-1',
    })
    expect(result).toEqual(created)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ title: 'New Article', content: '<p>Hello</p>', collectionId: 'col-1' }),
      })
    )
  })

  it('updates an article status', async () => {
    const updated = { id: '1', status: 'PUBLISHED' }
    mockFetch.mockReturnValueOnce(mockResponse(updated))

    const result = await client.articles.update('1', { status: 'PUBLISHED' })
    expect(result).toEqual(updated)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/articles/1'),
      expect.objectContaining({ method: 'PATCH' })
    )
  })

  it('deletes an article and handles 204 No Content', async () => {
    mockFetch.mockReturnValueOnce(mockEmptyResponse(204))

    const result = await client.articles.delete('1')
    expect(result).toEqual({ success: true })
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/articles/1'),
      expect.objectContaining({ method: 'DELETE' })
    )
  })

  it('searches articles and returns results array', async () => {
    const results = [{ id: '1', title: 'Hello', slug: 'hello', snippet: '...', collection: { title: 'General', slug: 'general' }, readTime: 2 }]
    mockFetch.mockReturnValueOnce(mockResponse({ results }))

    const result = await client.articles.search('hello')
    expect(result).toEqual(results)
    const url: string = mockFetch.mock.calls[0][0] as string
    expect(url).toContain('/api/search')
    expect(url).toContain('q=hello')
  })

  it('throws HelpNestError on 404', async () => {
    mockFetch.mockReturnValueOnce(mockResponse({ error: 'Not found' }, 404))

    const { HelpNestError } = await import('../index')
    await expect(client.articles.get('nonexistent')).rejects.toThrow(HelpNestError)
  })

  it('throws HelpNestError on 401', async () => {
    mockFetch.mockReturnValueOnce(mockResponse({ error: 'Unauthorized' }, 401))

    const { HelpNestError } = await import('../index')
    await expect(client.articles.list()).rejects.toThrow(HelpNestError)
  })

  it('sends Authorization and workspace headers', async () => {
    mockFetch.mockReturnValueOnce(mockResponse({ data: [], total: 0 }))

    await client.articles.list()

    expect(mockFetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-key',
          'X-HelpNest-Workspace': 'test-workspace',
        }),
      })
    )
  })
})
