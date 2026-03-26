import { vi, beforeEach, describe, it, expect } from 'vitest'

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/db', () => ({
  prisma: {
    article: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    collection: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    member: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    workspace: { findFirst: vi.fn(), update: vi.fn() },
    apiKey: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}))

vi.mock('@/lib/auth-api', () => ({ requireAuth: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth: vi.fn(), resolveSessionUserId: vi.fn() }))
vi.mock('@/lib/cloud', () => ({ isCloudMode: vi.fn(() => false), getWorkspacePlan: vi.fn() }))
vi.mock('@/lib/demo', () => ({ isDemoMode: vi.fn(() => false) }))
vi.mock('@/lib/workspace', () => ({ resolveWorkspaceId: vi.fn() }))
vi.mock('@/lib/qdrant', () => ({ qdrant: { getCollections: vi.fn() } }))
vi.mock('@/lib/cloudflare-kv', () => ({ kvPutDomain: vi.fn() }))
vi.mock('@/lib/ai/resolve-provider', () => ({
  encryptApiKey: vi.fn((k: string) => `encrypted_${k}`),
}))

// help-visibility determines PUBLIC vs PUBLIC+INTERNAL access for search
vi.mock('@/lib/help-visibility', () => ({
  getApiVisibility: vi.fn(),
  getHelpCenterVisibility: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { GET, OPTIONS } from '@/app/api/search/route'
import { prisma } from '@/lib/db'
import { getApiVisibility } from '@/lib/help-visibility'

const mockWorkspaceFindFirst = vi.mocked(prisma.workspace.findFirst)
const mockQueryRaw = vi.mocked(prisma.$queryRaw)
const mockGetApiVisibility = vi.mocked(getApiVisibility)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRequest(url: string, options: RequestInit = {}): Request {
  return new Request(`http://localhost:3000${url}`, options)
}

// A minimal search result row as returned by the Postgres full-text query
function makeSearchRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'art-1',
    title: 'Getting Started',
    slug: 'getting-started',
    snippet: 'Learn how to get started with HelpNest',
    collection_title: 'Guides',
    collection_slug: 'guides',
    collection_visibility: 'PUBLIC',
    views: 42,
    word_count: 400,
    ...overrides,
  }
}

const WORKSPACE = { id: 'ws-123' }

beforeEach(() => {
  vi.clearAllMocks()
  // Default: workspace found, public visibility
  mockWorkspaceFindFirst.mockResolvedValue(WORKSPACE as never)
  mockGetApiVisibility.mockResolvedValue(['PUBLIC'])
  mockQueryRaw.mockResolvedValue([])
})

// ===========================================================================
// OPTIONS /api/search — CORS preflight
// ===========================================================================

describe('OPTIONS /api/search', () => {
  it('returns 204 with CORS headers', async () => {
    const res = await OPTIONS()

    expect(res.status).toBe(204)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('GET')
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('OPTIONS')
  })
})

// ===========================================================================
// GET /api/search
// ===========================================================================

describe('GET /api/search', () => {
  it('returns empty results when q is less than 2 characters', async () => {
    const res = await GET(createRequest('/api/search?q=a&workspace=helpnest'))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ results: [] })
    expect(mockQueryRaw).not.toHaveBeenCalled()
  })

  it('returns empty results when q is an empty string', async () => {
    const res = await GET(createRequest('/api/search?q=&workspace=helpnest'))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ results: [] })
  })

  it('returns empty results when q exceeds 200 characters', async () => {
    const longQuery = 'a'.repeat(201)
    const res = await GET(createRequest(`/api/search?q=${encodeURIComponent(longQuery)}&workspace=helpnest`))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ results: [] })
    expect(mockQueryRaw).not.toHaveBeenCalled()
  })

  it('returns empty results when workspace is not found', async () => {
    mockWorkspaceFindFirst.mockResolvedValue(null)

    const res = await GET(createRequest('/api/search?q=hello&workspace=unknown'))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ results: [] })
    // Should not attempt the expensive full-text query
    expect(mockQueryRaw).not.toHaveBeenCalled()
  })

  it('returns formatted search results from the full-text query', async () => {
    const row = makeSearchRow()
    mockQueryRaw.mockResolvedValue([row] as never)

    const res = await GET(createRequest('/api/search?q=getting+started&workspace=helpnest'))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.results).toHaveLength(1)

    const result = body.results[0]
    expect(result.id).toBe('art-1')
    expect(result.title).toBe('Getting Started')
    expect(result.slug).toBe('getting-started')
    expect(result.snippet).toBe('Learn how to get started with HelpNest')
    expect(result.collection).toEqual({ title: 'Guides', slug: 'guides' })
    expect(result.internal).toBe(false)
  })

  it('marks a result as internal when collection_visibility is INTERNAL', async () => {
    const row = makeSearchRow({ collection_visibility: 'INTERNAL' })
    mockQueryRaw.mockResolvedValue([row] as never)

    const res = await GET(createRequest('/api/search?q=internal+docs&workspace=helpnest'))

    const body = await res.json()
    expect(body.results[0].internal).toBe(true)
  })

  it('computes readTime as ceiling of word_count / 200, minimum 1 minute', async () => {
    // 400 words → 2 min
    const row400 = makeSearchRow({ word_count: 400 })
    // 0 words → should clamp to 1 min
    const row0 = makeSearchRow({ id: 'art-2', word_count: 0 })
    // 100 words → 1 min (rounds to 0.5, ceil → 1)
    const row100 = makeSearchRow({ id: 'art-3', word_count: 100 })

    mockQueryRaw.mockResolvedValue([row400, row0, row100] as never)

    const res = await GET(createRequest('/api/search?q=read+time&workspace=helpnest'))
    const body = await res.json()

    expect(body.results[0].readTime).toBe(2)  // 400/200 = 2
    expect(body.results[1].readTime).toBe(1)  // 0/200 → clamped to 1
    expect(body.results[2].readTime).toBe(1)  // 100/200 = 0.5 → Math.round = 1, Math.max(1, 1) = 1
  })

  it('falls back to empty string when snippet is null', async () => {
    const row = makeSearchRow({ snippet: null })
    mockQueryRaw.mockResolvedValue([row] as never)

    const res = await GET(createRequest('/api/search?q=hello&workspace=helpnest'))
    const body = await res.json()

    expect(body.results[0].snippet).toBe('')
  })

  it('includes CORS Access-Control-Allow-Origin header in GET response', async () => {
    mockQueryRaw.mockResolvedValue([])

    const res = await GET(createRequest('/api/search?q=test&workspace=helpnest'))

    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
  })

  it('looks up the workspace by the slug param', async () => {
    mockQueryRaw.mockResolvedValue([])

    await GET(createRequest('/api/search?q=hello&workspace=my-workspace'))

    expect(mockWorkspaceFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { slug: 'my-workspace' },
      })
    )
  })

  it('calls getApiVisibility to determine visibility for the raw SQL query', async () => {
    mockQueryRaw.mockResolvedValue([])

    await GET(createRequest('/api/search?q=hello&workspace=helpnest'))

    expect(mockGetApiVisibility).toHaveBeenCalledWith(
      expect.any(Request),
      WORKSPACE.id
    )
  })

  it('returns empty results and CORS headers when q is exactly 1 char', async () => {
    const res = await GET(createRequest('/api/search?q=x'))

    expect(res.status).toBe(200)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
    const body = await res.json()
    expect(body.results).toEqual([])
  })

  it('accepts q of exactly 2 characters and proceeds to search', async () => {
    mockQueryRaw.mockResolvedValue([])

    const res = await GET(createRequest('/api/search?q=ab&workspace=helpnest'))

    expect(res.status).toBe(200)
    // Should have attempted the workspace lookup (i.e., not short-circuited)
    expect(mockWorkspaceFindFirst).toHaveBeenCalled()
  })

  it('accepts q of exactly 200 characters and proceeds to search', async () => {
    mockQueryRaw.mockResolvedValue([])
    const q = 'a'.repeat(200)

    const res = await GET(createRequest(`/api/search?q=${encodeURIComponent(q)}&workspace=helpnest`))

    expect(res.status).toBe(200)
    expect(mockWorkspaceFindFirst).toHaveBeenCalled()
  })
})
