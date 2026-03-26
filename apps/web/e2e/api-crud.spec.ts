import { test, expect } from '@playwright/test'

// ---------------------------------------------------------------------------
// API contract tests — verify HTTP status codes, response shapes, and
// authorization requirements without a browser UI.
// These use the Playwright APIRequestContext (request fixture).
// ---------------------------------------------------------------------------

test.describe('API — health endpoint', () => {
  test('returns 200 with the expected response shape', async ({ request }) => {
    const response = await request.get('/api/health')
    expect(response.status()).toBe(200)

    const body = await response.json()
    expect(body).toHaveProperty('status')
    expect(body).toHaveProperty('checks')
    expect(body).toHaveProperty('timestamp')
    expect(typeof body.timestamp).toBe('string')
    // Timestamp must be a valid ISO 8601 string
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp)
  })

  test('status is "ok" or "degraded"', async ({ request }) => {
    const body = await (await request.get('/api/health')).json()
    expect(['ok', 'degraded']).toContain(body.status)
  })

  test('checks object contains at least a "database" key', async ({ request }) => {
    const body = await (await request.get('/api/health')).json()
    expect(body.checks).toHaveProperty('database')
    expect(['ok', 'error']).toContain(body.checks.database)
  })
})

test.describe('API — authorization guards', () => {
  // Every endpoint that requires a workspace session must return 401 for
  // unauthenticated callers.  This validates the requireAuth() boundary.

  test('GET /api/articles returns 401 without auth', async ({ request }) => {
    const res = await request.get('/api/articles')
    expect(res.status()).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  test('POST /api/articles returns 401 without auth', async ({ request }) => {
    const res = await request.post('/api/articles', {
      data: { title: 'Test Article', content: '<p>Test</p>' },
    })
    expect(res.status()).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  test('GET /api/collections returns 401 without auth', async ({ request }) => {
    const res = await request.get('/api/collections')
    expect(res.status()).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  test('POST /api/collections returns 401 without auth', async ({ request }) => {
    const res = await request.post('/api/collections', {
      data: { title: 'New Collection' },
    })
    expect(res.status()).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  test('GET /api/api-keys returns 401 without auth', async ({ request }) => {
    const res = await request.get('/api/api-keys')
    expect(res.status()).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  test('GET /api/members returns 401 without auth', async ({ request }) => {
    const res = await request.get('/api/members')
    expect(res.status()).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })
})

test.describe('API — search endpoint', () => {
  // Search is public (CORS-enabled) and does not require auth.
  // It requires workspace=<slug> and q=<term>.

  test('OPTIONS returns CORS headers for preflight', async ({ request }) => {
    const res = await request.fetch('/api/search', { method: 'OPTIONS' })
    expect(res.status()).toBe(204)
    expect(res.headers()['access-control-allow-origin']).toBe('*')
    expect(res.headers()['access-control-allow-methods']).toContain('GET')
  })

  test('returns empty results when query is shorter than 2 characters', async ({ request }) => {
    const res = await request.get('/api/search?q=a&workspace=HelpNest')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.results).toEqual([])
  })

  test('returns an array for a valid query against the seeded workspace', async ({ request }) => {
    const res = await request.get('/api/search?q=getting+started&workspace=HelpNest')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('results')
    expect(Array.isArray(body.results)).toBe(true)
  })

  test('result items have the expected shape', async ({ request }) => {
    // Use a broad term likely to match at least one seeded article
    const res = await request.get('/api/search?q=help&workspace=HelpNest')
    expect(res.status()).toBe(200)
    const { results } = await res.json()

    if (results.length > 0) {
      const item = results[0]
      expect(item).toHaveProperty('id')
      expect(item).toHaveProperty('title')
      expect(item).toHaveProperty('slug')
      expect(item).toHaveProperty('snippet')
      expect(item).toHaveProperty('collection')
      expect(item.collection).toHaveProperty('title')
      expect(item.collection).toHaveProperty('slug')
      expect(item).toHaveProperty('readTime')
      expect(typeof item.readTime).toBe('number')
      expect(item.readTime).toBeGreaterThanOrEqual(1)
    }
  })

  test('returns empty results for an unknown workspace slug', async ({ request }) => {
    const res = await request.get('/api/search?q=anything&workspace=this-workspace-does-not-exist')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.results).toEqual([])
  })

  test('returns empty results when query exceeds 200 characters', async ({ request }) => {
    const longQuery = 'a'.repeat(201)
    const res = await request.get(`/api/search?q=${longQuery}&workspace=HelpNest`)
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.results).toEqual([])
  })
})
