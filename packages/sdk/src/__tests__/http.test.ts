import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HttpClient, HelpNestError } from '../http'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function mockResponse<T>(data: T, status = 200, contentLength: string | null = null) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: {
      get: (h: string) => (h === 'content-length' ? contentLength : null),
    },
    json: () => Promise.resolve(data),
  } as Response)
}

function mockErrorResponse(error: unknown, status = 400) {
  return Promise.resolve({
    ok: false,
    status,
    statusText: 'Bad Request',
    headers: { get: () => null },
    json: () => Promise.resolve(error),
  } as Response)
}

describe('HttpClient', () => {
  let client: HttpClient

  beforeEach(() => {
    mockFetch.mockReset()
    client = new HttpClient({
      baseUrl: 'https://api.helpnest.io',
      workspace: 'test-workspace',
      apiKey: 'sk_test_123',
    })
  })

  describe('constructor', () => {
    it('should normalize baseUrl by removing trailing slash', () => {
      const clientWithSlash = new HttpClient({
        baseUrl: 'https://api.helpnest.io/',
        workspace: 'ws',
        apiKey: 'key',
      })

      mockFetch.mockReturnValueOnce(mockResponse({ data: [] }))
      clientWithSlash.get('/articles')

      const url = mockFetch.mock.calls[0][0]
      expect(url).toContain('https://api.helpnest.io/api')
    })

    it('should use default baseUrl when not provided', () => {
      const clientDefault = new HttpClient({
        workspace: 'ws',
        apiKey: 'key',
      })

      mockFetch.mockReturnValueOnce(mockResponse({ data: [] }))
      clientDefault.get('/articles')

      const url = mockFetch.mock.calls[0][0]
      expect(url).toContain('https://helpnest.cloud/api')
    })
  })

  describe('buildUrl', () => {
    it('should construct full URL with /api prefix', async () => {
      mockFetch.mockReturnValueOnce(mockResponse({ data: [] }))

      await client.get('/articles')

      const url = mockFetch.mock.calls[0][0]
      expect(url).toContain('https://api.helpnest.io/api/articles')
    })

    it('should always include workspace query parameter', async () => {
      mockFetch.mockReturnValueOnce(mockResponse({ data: [] }))

      await client.get('/articles')

      const url = mockFetch.mock.calls[0][0]
      expect(url).toContain('workspace=test-workspace')
    })

    it('should serialize query parameters correctly', async () => {
      mockFetch.mockReturnValueOnce(mockResponse({ data: [] }))

      await client.get('/articles', { limit: 10, offset: 20 })

      const url = mockFetch.mock.calls[0][0]
      expect(url).toContain('limit=10')
      expect(url).toContain('offset=20')
      expect(url).toContain('workspace=test-workspace')
    })

    it('should skip undefined query parameters', async () => {
      mockFetch.mockReturnValueOnce(mockResponse({ data: [] }))

      await client.get('/articles', { limit: 10, offset: undefined })

      const url = mockFetch.mock.calls[0][0]
      expect(url).toContain('limit=10')
      expect(url).not.toContain('offset=')
    })

    it('should convert boolean and number parameters to strings', async () => {
      mockFetch.mockReturnValueOnce(mockResponse({ data: [] }))

      await client.get('/articles', { published: true, limit: 50 })

      const url = mockFetch.mock.calls[0][0]
      expect(url).toContain('published=true')
      expect(url).toContain('limit=50')
    })

    it('should handle special characters in parameters', async () => {
      mockFetch.mockReturnValueOnce(mockResponse({ data: [] }))

      await client.get('/articles', { search: 'hello world' })

      const url = mockFetch.mock.calls[0][0]
      expect(url).toContain('search=hello')
      expect(url).toContain('world')
    })
  })

  describe('headers', () => {
    it('should include Authorization header with Bearer token', async () => {
      mockFetch.mockReturnValueOnce(mockResponse({ data: [] }))

      await client.get('/articles')

      const options = mockFetch.mock.calls[0][1]
      expect(options.headers['Authorization']).toBe('Bearer sk_test_123')
    })

    it('should include Content-Type header as application/json', async () => {
      mockFetch.mockReturnValueOnce(mockResponse({ data: [] }))

      await client.get('/articles')

      const options = mockFetch.mock.calls[0][1]
      expect(options.headers['Content-Type']).toBe('application/json')
    })

    it('should include X-HelpNest-Workspace header', async () => {
      mockFetch.mockReturnValueOnce(mockResponse({ data: [] }))

      await client.get('/articles')

      const options = mockFetch.mock.calls[0][1]
      expect(options.headers['X-HelpNest-Workspace']).toBe('test-workspace')
    })

    it('should include all headers in every request method', async () => {
      mockFetch.mockReturnValueOnce(mockResponse({ success: true }))
      await client.post('/articles', { title: 'Test' })

      mockFetch.mockReturnValueOnce(mockResponse({ success: true }))
      await client.patch('/articles/1', { title: 'Updated' })

      mockFetch.mockReturnValueOnce(mockResponse({ success: true }))
      await client.delete('/articles/1')

      for (let i = 0; i < 3; i++) {
        const options = mockFetch.mock.calls[i][1]
        expect(options.headers['Authorization']).toBe('Bearer sk_test_123')
        expect(options.headers['X-HelpNest-Workspace']).toBe('test-workspace')
      }
    })
  })

  describe('get', () => {
    it('should make GET request with correct method', async () => {
      mockFetch.mockReturnValueOnce(mockResponse({ data: [] }))

      await client.get('/articles')

      const options = mockFetch.mock.calls[0][1]
      expect(options.method).toBe('GET')
    })

    it('should return parsed JSON response', async () => {
      const expectedData = [{ id: '1', title: 'Test Article' }]
      mockFetch.mockReturnValueOnce(mockResponse({ data: expectedData }))

      const result = await client.get('/articles')

      expect(result).toEqual({ data: expectedData })
    })

    it('should pass query parameters in URL', async () => {
      mockFetch.mockReturnValueOnce(mockResponse({ data: [] }))

      await client.get('/articles', { limit: 10 })

      const url = mockFetch.mock.calls[0][0]
      expect(url).toContain('limit=10')
    })
  })

  describe('post', () => {
    it('should make POST request with correct method', async () => {
      mockFetch.mockReturnValueOnce(mockResponse({ id: '1', title: 'New' }))

      await client.post('/articles', { title: 'New' })

      const options = mockFetch.mock.calls[0][1]
      expect(options.method).toBe('POST')
    })

    it('should stringify body as JSON', async () => {
      mockFetch.mockReturnValueOnce(mockResponse({ id: '1', title: 'New' }))

      const payload = { title: 'New Article', content: 'Test' }
      await client.post('/articles', payload)

      const options = mockFetch.mock.calls[0][1]
      expect(options.body).toBe(JSON.stringify(payload))
    })

    it('should not include body when payload is undefined', async () => {
      mockFetch.mockReturnValueOnce(mockResponse({ success: true }))

      await client.post('/webhook')

      const options = mockFetch.mock.calls[0][1]
      expect(options.body).toBeUndefined()
    })

    it('should return parsed JSON response', async () => {
      const created = { id: '1', title: 'New Article' }
      mockFetch.mockReturnValueOnce(mockResponse(created))

      const result = await client.post('/articles', { title: 'New Article' })

      expect(result).toEqual(created)
    })
  })

  describe('patch', () => {
    it('should make PATCH request with correct method', async () => {
      mockFetch.mockReturnValueOnce(mockResponse({ id: '1', title: 'Updated' }))

      await client.patch('/articles/1', { title: 'Updated' })

      const options = mockFetch.mock.calls[0][1]
      expect(options.method).toBe('PATCH')
    })

    it('should stringify body as JSON', async () => {
      mockFetch.mockReturnValueOnce(mockResponse({ id: '1', title: 'Updated' }))

      const payload = { title: 'Updated Article' }
      await client.patch('/articles/1', payload)

      const options = mockFetch.mock.calls[0][1]
      expect(options.body).toBe(JSON.stringify(payload))
    })

    it('should return parsed JSON response', async () => {
      const updated = { id: '1', title: 'Updated Article' }
      mockFetch.mockReturnValueOnce(mockResponse(updated))

      const result = await client.patch('/articles/1', { title: 'Updated Article' })

      expect(result).toEqual(updated)
    })
  })

  describe('delete', () => {
    it('should make DELETE request with correct method', async () => {
      mockFetch.mockReturnValueOnce(mockResponse({ success: true }))

      await client.delete('/articles/1')

      const options = mockFetch.mock.calls[0][1]
      expect(options.method).toBe('DELETE')
    })

    it('should not include body in DELETE request', async () => {
      mockFetch.mockReturnValueOnce(mockResponse({ success: true }))

      await client.delete('/articles/1')

      const options = mockFetch.mock.calls[0][1]
      expect(options.body).toBeUndefined()
    })

    it('should return parsed JSON response', async () => {
      mockFetch.mockReturnValueOnce(mockResponse({ success: true }))

      const result = await client.delete('/articles/1')

      expect(result).toEqual({ success: true })
    })
  })

  describe('handleResponse', () => {
    it('should return parsed JSON for successful responses', async () => {
      const data = { articles: [{ id: '1' }] }
      mockFetch.mockReturnValueOnce(mockResponse(data))

      const result = await client.get('/articles')

      expect(result).toEqual(data)
    })

    it('should handle 204 No Content responses', async () => {
      mockFetch.mockReturnValueOnce(mockResponse(null, 204, '0'))

      const result = await client.delete('/articles/1')

      expect(result).toEqual({ success: true })
    })

    it('should handle responses with content-length 0', async () => {
      mockFetch.mockReturnValueOnce(mockResponse(null, 200, '0'))

      const result = await client.get('/status')

      expect(result).toEqual({ success: true })
    })

    it('should throw HelpNestError on 4xx responses', async () => {
      mockFetch.mockReturnValueOnce(mockErrorResponse({ error: 'Not found' }, 404))

      await expect(client.get('/articles/invalid')).rejects.toThrow(HelpNestError)
    })

    it('should throw HelpNestError on 5xx responses', async () => {
      mockFetch.mockReturnValueOnce(mockErrorResponse({ error: 'Internal error' }, 500))

      await expect(client.get('/articles')).rejects.toThrow(HelpNestError)
    })

    it('should include error message from response JSON', async () => {
      mockFetch.mockReturnValueOnce(
        mockErrorResponse({ error: 'Article not found' }, 404)
      )

      await expect(client.get('/articles/invalid')).rejects.toThrow(
        'HelpNest API error: Article not found'
      )
    })

    it('should use generic message when error details not available', async () => {
      mockFetch.mockReturnValueOnce(
        mockErrorResponse({ message: 'something' }, 500)
      )

      await expect(client.get('/articles')).rejects.toThrow(
        /HelpNest API error: 500/
      )
    })

    it('should handle JSON parse errors gracefully', async () => {
      mockFetch.mockReturnValueOnce(
        Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          headers: { get: () => null },
          json: () => Promise.reject(new Error('Invalid JSON')),
        } as Response)
      )

      await expect(client.get('/articles')).rejects.toThrow(
        'HelpNest API error: 500 Internal Server Error'
      )
    })
  })

  describe('HelpNestError', () => {
    it('should be an Error instance', () => {
      const error = new HelpNestError('Test error', 404)
      expect(error).toBeInstanceOf(Error)
    })

    it('should have correct name', () => {
      const error = new HelpNestError('Test error', 404)
      expect(error.name).toBe('HelpNestError')
    })

    it('should include message', () => {
      const error = new HelpNestError('Not found', 404)
      expect(error.message).toBe('Not found')
    })

    it('should include statusCode property', () => {
      const error = new HelpNestError('Unauthorized', 401)
      expect(error.statusCode).toBe(401)
    })

    it('should preserve statusCode for different error codes', () => {
      const errors = [
        new HelpNestError('Bad Request', 400),
        new HelpNestError('Unauthorized', 401),
        new HelpNestError('Not Found', 404),
        new HelpNestError('Conflict', 409),
        new HelpNestError('Server Error', 500),
      ]

      errors.forEach((error, index) => {
        expect(error.statusCode).toBe([400, 401, 404, 409, 500][index])
      })
    })
  })

  describe('integration scenarios', () => {
    it('should handle complete GET workflow', async () => {
      const mockData = {
        data: [
          { id: '1', title: 'Article 1', slug: 'article-1' },
          { id: '2', title: 'Article 2', slug: 'article-2' },
        ],
        total: 2,
      }
      mockFetch.mockReturnValueOnce(mockResponse(mockData))

      const result = await client.get('/articles', { limit: 50, offset: 0 })

      const url = mockFetch.mock.calls[0][0]
      const options = mockFetch.mock.calls[0][1]

      expect(url).toContain('/api/articles')
      expect(url).toContain('limit=50')
      expect(url).toContain('workspace=test-workspace')
      expect(options.method).toBe('GET')
      expect(options.headers['Authorization']).toBe('Bearer sk_test_123')
      expect(result).toEqual(mockData)
    })

    it('should handle complete POST workflow', async () => {
      const created = { id: '3', title: 'New Article', slug: 'new-article', status: 'DRAFT' }
      mockFetch.mockReturnValueOnce(mockResponse(created, 201))

      const payload = { title: 'New Article', content: '<p>Test</p>' }
      const result = await client.post('/articles', payload)

      const url = mockFetch.mock.calls[0][0]
      const options = mockFetch.mock.calls[0][1]

      expect(url).toContain('/api/articles')
      expect(url).toContain('workspace=test-workspace')
      expect(options.method).toBe('POST')
      expect(options.body).toBe(JSON.stringify(payload))
      expect(options.headers['Content-Type']).toBe('application/json')
      expect(result).toEqual(created)
    })

    it('should handle complete PATCH workflow', async () => {
      const updated = { id: '1', title: 'Updated Article', status: 'PUBLISHED' }
      mockFetch.mockReturnValueOnce(mockResponse(updated))

      const result = await client.patch('/articles/1', { status: 'PUBLISHED' })

      const options = mockFetch.mock.calls[0][1]
      expect(options.method).toBe('PATCH')
      expect(result).toEqual(updated)
    })

    it('should handle error response with status code preservation', async () => {
      mockFetch.mockReturnValueOnce(mockErrorResponse({ error: 'Unauthorized' }, 401))

      try {
        await client.get('/protected')
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(HelpNestError)
        expect((error as HelpNestError).statusCode).toBe(401)
      }
    })
  })
})
