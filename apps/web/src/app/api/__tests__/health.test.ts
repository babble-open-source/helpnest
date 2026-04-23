import { vi, beforeEach, describe, it, expect } from 'vitest'

// ---------------------------------------------------------------------------
// Module mocks — must be declared before imports
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

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { GET } from '@/app/api/health/route'
import { prisma } from '@/lib/db'
import { qdrant } from '@/lib/qdrant'

const mockQueryRaw = vi.mocked(prisma.$queryRaw)
const mockQdrantGetCollections = vi.mocked(qdrant.getCollections)

// Preserve and restore env vars around tests that mutate process.env
const originalEnv = process.env

beforeEach(() => {
  vi.clearAllMocks()
  // Reset env to a clean slate (no QDRANT_URL by default)
  process.env = { ...originalEnv }
  delete process.env.QDRANT_URL
})

// ===========================================================================
// GET /api/health
// ===========================================================================

describe('GET /api/health', () => {
  it('returns 200 with status "ok" when the database is healthy', async () => {
    mockQueryRaw.mockResolvedValue([{ '?column?': 1 }] as never)

    const res = await GET()

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.checks.database).toBe('ok')
  })

  it('returns 200 with status "degraded" when the DB $queryRaw throws', async () => {
    mockQueryRaw.mockRejectedValue(new Error('Connection refused'))

    const res = await GET()

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('degraded')
    expect(body.checks.database).toBe('error')
  })

  it('includes a timestamp in the ISO 8601 response', async () => {
    mockQueryRaw.mockResolvedValue([{ '?column?': 1 }] as never)

    const before = new Date()
    const res = await GET()
    const after = new Date()

    const body = await res.json()
    expect(body.timestamp).toBeDefined()

    const ts = new Date(body.timestamp as string)
    expect(ts.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000)
    expect(ts.getTime()).toBeLessThanOrEqual(after.getTime() + 1000)
  })

  it('does NOT check Qdrant when QDRANT_URL is not set', async () => {
    mockQueryRaw.mockResolvedValue([{ '?column?': 1 }] as never)

    const res = await GET()
    const body = await res.json()

    expect(mockQdrantGetCollections).not.toHaveBeenCalled()
    expect(body.checks.qdrant).toBeUndefined()
  })

  it('checks Qdrant and reports ok when QDRANT_URL is set and Qdrant is healthy', async () => {
    process.env.QDRANT_URL = 'http://localhost:6333'
    mockQueryRaw.mockResolvedValue([{ '?column?': 1 }] as never)
    mockQdrantGetCollections.mockResolvedValue({ collections: [] } as never)

    const res = await GET()

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.checks.qdrant).toBe('ok')
    expect(mockQdrantGetCollections).toHaveBeenCalledOnce()
  })

  it('returns 200 with degraded when QDRANT_URL is set but Qdrant is unreachable', async () => {
    process.env.QDRANT_URL = 'http://localhost:6333'
    mockQueryRaw.mockResolvedValue([{ '?column?': 1 }] as never)
    mockQdrantGetCollections.mockRejectedValue(new Error('ECONNREFUSED'))

    const res = await GET()

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('degraded')
    expect(body.checks.database).toBe('ok')
    expect(body.checks.qdrant).toBe('error')
  })

  it('returns 200 degraded when both DB and Qdrant fail', async () => {
    process.env.QDRANT_URL = 'http://localhost:6333'
    mockQueryRaw.mockRejectedValue(new Error('DB down'))
    mockQdrantGetCollections.mockRejectedValue(new Error('Qdrant down'))

    const res = await GET()

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('degraded')
    expect(body.checks.database).toBe('error')
    expect(body.checks.qdrant).toBe('error')
  })

  it('response body contains a checks object with at least the database key', async () => {
    mockQueryRaw.mockResolvedValue([{ '?column?': 1 }] as never)

    const res = await GET()
    const body = await res.json()

    expect(body).toHaveProperty('checks')
    expect(body.checks).toHaveProperty('database')
  })
})
