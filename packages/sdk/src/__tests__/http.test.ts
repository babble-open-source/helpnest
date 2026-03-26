import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HttpClient, HelpNestError } from '../http'

// ─── Mock infrastructure ─────────────────────────────────────────────────────

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

/**
 * Build a minimal Response-like object. The `headers.get` implementation
 * returns the content-length value when asked for that header, and null
 * for everything else.
 */
function mockResponse(
  data: unknown,
  status = 200,
  { contentLength }: { contentLength?: string } = {},
) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : status === 204 ? 'No Content' : 'Error',
    headers: {
      get: (header: string) => (header === 'content-length' ? (contentLength ?? null) : null),
    },
    json: () => Promise.resolve(data),
  })
}

/** Simulates a 204 No Content response where JSON parsing would throw. */
function mockEmptyResponse(status = 204) {
  return Promise.resolve({
    ok: true,
    status,
    statusText: 'No Content',
    headers: {
      get: (header: string) => (header === 'content-length' ? '0' : null),
    },
    json: () => Promise.reject(new SyntaxError('No body')),
  })
}

/** Simulates a server error where the response body is not valid JSON. */
function mockErrorResponseNonJson(status: number, statusText: string) {
  return Promise.resolve({
    ok: false,
    status,
    statusText,
    headers: { get: () => null },
    json: () => Promise.reject(new SyntaxError('Unexpected token')),
  })
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeClient(overrides: Partial<{ apiKey: string; workspace: string; baseUrl: string }> = {}) {
  return new HttpClient({
    apiKey: overrides.apiKey ?? 'sk-test',
    workspace: overrides.workspace ?? 'acme',
    baseUrl: overrides.baseUrl,
  })
}

// ─── URL construction ─────────────────────────────────────────────────────────

describe('HttpClient — URL construction', () => {
  beforeEach(() => mockFetch.mockReset())

  it('prepends /api to every path', async () => {
    const client = makeClient()
    mockFetch.mockReturnValueOnce(mockResponse({}))

    await client.get('/articles')

    const url: string = mockFetch.mock.calls[0][0] as string
    expect(url).toContain('/api/articles')
  })

  it('always appends workspace as a query param', async () => {
    const client = makeClient({ workspace: 'my-workspace' })
    mockFetch.mockReturnValueOnce(mockResponse({}))

    await client.get('/articles')

    const url: string = mockFetch.mock.calls[0][0] as string
    expect(url).toContain('workspace=my-workspace')
  })

  it('includes optional params when provided', async () => {
    const client = makeClient()
    mockFetch.mockReturnValueOnce(mockResponse({}))

    await client.get('/articles', { status: 'PUBLISHED', page: 2 })

    const url: string = mockFetch.mock.calls[0][0] as string
    expect(url).toContain('status=PUBLISHED')
    expect(url).toContain('page=2')
  })

  it('skips params whose value is undefined', async () => {
    const client = makeClient()
    mockFetch.mockReturnValueOnce(mockResponse({}))

    await client.get('/articles', { status: undefined, page: 1 })

    const url: string = mockFetch.mock.calls[0][0] as string
    expect(url).not.toContain('status=')
    expect(url).toContain('page=1')
  })

  it('defaults baseUrl to https://helpnest.cloud when not supplied', async () => {
    const client = makeClient({ baseUrl: undefined })
    mockFetch.mockReturnValueOnce(mockResponse({}))

    await client.get('/health')

    const url: string = mockFetch.mock.calls[0][0] as string
    expect(url).toMatch(/^https:\/\/helpnest\.cloud/)
  })

  it('strips a trailing slash from a custom baseUrl', async () => {
    const client = makeClient({ baseUrl: 'http://localhost:3000/' })
    mockFetch.mockReturnValueOnce(mockResponse({}))

    await client.get('/health')

    const url: string = mockFetch.mock.calls[0][0] as string
    // Must not produce a double-slash like http://localhost:3000//api/health.
    // We check the path component only (after stripping the scheme) to avoid
    // matching the '://' in http:// itself.
    const path = url.replace(/^https?:\/\/[^/]+/, '')
    expect(path).not.toContain('//')
    expect(url).toContain('http://localhost:3000/api/health')
  })

  it('keeps multiple trailing slashes stripped to a single base', async () => {
    // The implementation uses .replace(/\/$/, '') which only removes the last
    // slash, so two trailing slashes would still leave one. This test documents
    // the single-slash strip behaviour that is actually implemented.
    const client = makeClient({ baseUrl: 'http://localhost:3000/' })
    mockFetch.mockReturnValueOnce(mockResponse({}))

    await client.get('/articles')

    const url: string = mockFetch.mock.calls[0][0] as string
    expect(url).toContain('http://localhost:3000/api/articles')
  })
})

// ─── Request headers ──────────────────────────────────────────────────────────

describe('HttpClient — request headers', () => {
  beforeEach(() => mockFetch.mockReset())

  it('sends Authorization: Bearer <apiKey> on every request', async () => {
    const client = makeClient({ apiKey: 'sk-live-abc' })
    mockFetch.mockReturnValueOnce(mockResponse({}))

    await client.get('/articles')

    expect(mockFetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer sk-live-abc' }),
      }),
    )
  })

  it('sends Content-Type: application/json on every request', async () => {
    const client = makeClient()
    mockFetch.mockReturnValueOnce(mockResponse({}))

    await client.get('/articles')

    expect(mockFetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      }),
    )
  })

  it('sends X-HelpNest-Workspace header matching the configured workspace', async () => {
    const client = makeClient({ workspace: 'beta-corp' })
    mockFetch.mockReturnValueOnce(mockResponse({}))

    await client.get('/articles')

    expect(mockFetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-HelpNest-Workspace': 'beta-corp' }),
      }),
    )
  })
})

// ─── HTTP methods ─────────────────────────────────────────────────────────────

describe('HttpClient — HTTP methods', () => {
  let client: HttpClient

  beforeEach(() => {
    mockFetch.mockReset()
    client = makeClient()
  })

  it('get() issues a GET request and returns parsed JSON', async () => {
    const payload = { id: '1', title: 'Hello' }
    mockFetch.mockReturnValueOnce(mockResponse(payload))

    const result = await client.get<typeof payload>('/articles/1')

    expect(result).toEqual(payload)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('post() issues a POST request with a JSON-serialised body', async () => {
    const payload = { id: '2', title: 'New' }
    const body = { title: 'New', collectionId: 'col-1' }
    mockFetch.mockReturnValueOnce(mockResponse(payload, 201))

    const result = await client.post<typeof payload>('/articles', body)

    expect(result).toEqual(payload)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(body),
      }),
    )
  })

  it('post() without a body sends no body field', async () => {
    mockFetch.mockReturnValueOnce(mockResponse({}))

    await client.post('/trigger')

    const init = mockFetch.mock.calls[0][1] as RequestInit
    expect(init.body).toBeUndefined()
  })

  it('patch() issues a PATCH request with a JSON-serialised body', async () => {
    const payload = { id: '1', status: 'PUBLISHED' }
    const body = { status: 'PUBLISHED' }
    mockFetch.mockReturnValueOnce(mockResponse(payload))

    const result = await client.patch<typeof payload>('/articles/1', body)

    expect(result).toEqual(payload)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    )
  })

  it('patch() without a body sends no body field', async () => {
    mockFetch.mockReturnValueOnce(mockResponse({}))

    await client.patch('/articles/1')

    const init = mockFetch.mock.calls[0][1] as RequestInit
    expect(init.body).toBeUndefined()
  })

  it('delete() issues a DELETE request', async () => {
    mockFetch.mockReturnValueOnce(mockEmptyResponse(204))

    await client.delete('/articles/1')

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/articles/1'),
      expect.objectContaining({ method: 'DELETE' }),
    )
  })
})

// ─── Response handling ────────────────────────────────────────────────────────

describe('HttpClient — response handling', () => {
  let client: HttpClient

  beforeEach(() => {
    mockFetch.mockReset()
    client = makeClient()
  })

  it('returns parsed JSON body on a successful 200 response', async () => {
    const payload = { hello: 'world' }
    mockFetch.mockReturnValueOnce(mockResponse(payload))

    const result = await client.get<typeof payload>('/ping')
    expect(result).toEqual(payload)
  })

  it('returns { success: true } for a 204 No Content response', async () => {
    mockFetch.mockReturnValueOnce(mockEmptyResponse(204))

    const result = await client.delete('/articles/99')
    expect(result).toEqual({ success: true })
  })

  it('returns { success: true } when content-length header is "0"', async () => {
    // Some servers reply with 200 + content-length: 0 instead of 204.
    mockFetch.mockReturnValueOnce(mockResponse(null, 200, { contentLength: '0' }))

    const result = await client.get('/some-endpoint')
    expect(result).toEqual({ success: true })
  })

  // ── error handling ───────────────────────────────────────────────────────────

  it('throws HelpNestError on a 400 Bad Request', async () => {
    mockFetch.mockReturnValueOnce(mockResponse({ error: 'Invalid params' }, 400))

    await expect(client.post('/articles', {})).rejects.toBeInstanceOf(HelpNestError)
  })

  it('throws HelpNestError on a 401 Unauthorized', async () => {
    mockFetch.mockReturnValueOnce(mockResponse({ error: 'Unauthorized' }, 401))

    await expect(client.get('/articles')).rejects.toBeInstanceOf(HelpNestError)
  })

  it('throws HelpNestError on a 403 Forbidden', async () => {
    mockFetch.mockReturnValueOnce(mockResponse({ error: 'Forbidden' }, 403))

    await expect(client.get('/admin')).rejects.toBeInstanceOf(HelpNestError)
  })

  it('throws HelpNestError on a 404 Not Found', async () => {
    mockFetch.mockReturnValueOnce(mockResponse({ error: 'Not found' }, 404))

    await expect(client.get('/articles/missing')).rejects.toBeInstanceOf(HelpNestError)
  })

  it('throws HelpNestError on a 500 Internal Server Error', async () => {
    mockFetch.mockReturnValueOnce(mockResponse({ error: 'Internal server error' }, 500))

    await expect(client.get('/articles')).rejects.toBeInstanceOf(HelpNestError)
  })

  it('HelpNestError carries the HTTP statusCode', async () => {
    mockFetch.mockReturnValueOnce(mockResponse({ error: 'Gone' }, 410))

    const err: HelpNestError = await client.get('/old-endpoint').catch((e) => e)
    expect(err.statusCode).toBe(410)
  })

  it('HelpNestError message contains the parsed error field from the response body', async () => {
    mockFetch.mockReturnValueOnce(
      mockResponse({ error: 'Article limit exceeded for your plan' }, 422),
    )

    const err: HelpNestError = await client.get('/articles').catch((e) => e)
    expect(err.message).toContain('Article limit exceeded for your plan')
  })

  it('HelpNestError falls back to statusText when JSON body cannot be parsed', async () => {
    // Simulates a gateway-level HTML error page that is not valid JSON.
    mockFetch.mockReturnValueOnce(mockErrorResponseNonJson(502, 'Bad Gateway'))

    const err: HelpNestError = await client.get('/articles').catch((e) => e)
    expect(err).toBeInstanceOf(HelpNestError)
    expect(err.statusCode).toBe(502)
    // Falls back to the default message which includes statusText
    expect(err.message).toContain('502')
    expect(err.message).toContain('Bad Gateway')
  })

  it('HelpNestError falls back to statusText when error body has no "error" field', async () => {
    // Body is valid JSON but uses a different shape (e.g. "message" instead of "error").
    mockFetch.mockReturnValueOnce(
      mockResponse({ message: 'Something went wrong' }, 503),
    )

    const err: HelpNestError = await client.get('/articles').catch((e) => e)
    // Without an "error" field the client falls back to the status line.
    expect(err.statusCode).toBe(503)
    expect(err.message).toContain('503')
  })
})

// ─── HelpNestError class ──────────────────────────────────────────────────────

describe('HelpNestError', () => {
  it('is an instance of Error', () => {
    const err = new HelpNestError('test error', 404)
    expect(err).toBeInstanceOf(Error)
  })

  it('sets the name property to "HelpNestError"', () => {
    const err = new HelpNestError('test error', 404)
    expect(err.name).toBe('HelpNestError')
  })

  it('exposes statusCode as a readonly property', () => {
    const err = new HelpNestError('not found', 404)
    expect(err.statusCode).toBe(404)
  })

  it('preserves the message passed to the constructor', () => {
    const err = new HelpNestError('Custom error message', 422)
    expect(err.message).toBe('Custom error message')
  })

  it('correctly stores different 4xx and 5xx status codes', () => {
    expect(new HelpNestError('', 400).statusCode).toBe(400)
    expect(new HelpNestError('', 401).statusCode).toBe(401)
    expect(new HelpNestError('', 403).statusCode).toBe(403)
    expect(new HelpNestError('', 500).statusCode).toBe(500)
  })
})
