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

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { GET, POST } from '@/app/api/collections/route'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth-api'

// ---------------------------------------------------------------------------
// Prisma P2002 error factory
// ---------------------------------------------------------------------------

// Import Prisma namespace directly so instanceof checks use the same class
// that the route's `import { Prisma } from '@helpnest/db'` resolves to.
import { Prisma } from '@helpnest/db'

function makePrismaP2002(): InstanceType<typeof Prisma.PrismaClientKnownRequestError> {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '5.0.0',
    meta: { target: ['slug'] },
  })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRequest(url: string, options: RequestInit = {}): Request {
  return new Request(`http://localhost:3000${url}`, options)
}

function postRequest(body: object): Request {
  return createRequest('/api/collections', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const mockRequireAuth = vi.mocked(requireAuth)
const mockCollectionFindMany = vi.mocked(prisma.collection.findMany)
const mockCollectionFindFirst = vi.mocked(prisma.collection.findFirst)
const mockCollectionFindUnique = vi.mocked(prisma.collection.findUnique)
const mockCollectionCreate = vi.mocked(prisma.collection.create)
const mockCollectionCount = vi.mocked(prisma.collection.count)
const mockMemberFindFirst = vi.mocked(prisma.member.findFirst)

const WORKSPACE_ID = 'ws-abc'
const USER_ID = 'user-1'
const SESSION_AUTH = { workspaceId: WORKSPACE_ID, userId: USER_ID, via: 'session' as const }
const API_KEY_AUTH = { workspaceId: WORKSPACE_ID, via: 'apikey' as const }

const COLLECTION_STUB = {
  id: 'col-1',
  workspaceId: WORKSPACE_ID,
  title: 'Getting Started',
  slug: 'getting-started',
  emoji: '📚',
  description: null,
  visibility: 'PUBLIC',
  isArchived: false,
  order: 0,
  parentId: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-02'),
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ===========================================================================
// GET /api/collections
// ===========================================================================

describe('GET /api/collections', () => {
  it('returns 401 when requireAuth returns null', async () => {
    mockRequireAuth.mockResolvedValue(null)

    const res = await GET(createRequest('/api/collections'))

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body).toEqual({ error: 'Unauthorized' })
  })

  it('returns collections list with total count', async () => {
    mockRequireAuth.mockResolvedValue(SESSION_AUTH)
    mockCollectionFindMany.mockResolvedValue([COLLECTION_STUB] as never)

    const res = await GET(createRequest('/api/collections'))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(1)
    expect(body.total).toBe(1)
    expect(body.data[0].id).toBe('col-1')
  })

  it('always scopes query to the authenticated workspace', async () => {
    mockRequireAuth.mockResolvedValue(SESSION_AUTH)
    mockCollectionFindMany.mockResolvedValue([] as never)

    await GET(createRequest('/api/collections'))

    expect(mockCollectionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ workspaceId: WORKSPACE_ID }),
      })
    )
  })

  it('filters by visibility=PUBLIC when param is supplied', async () => {
    mockRequireAuth.mockResolvedValue(SESSION_AUTH)
    mockCollectionFindMany.mockResolvedValue([] as never)

    await GET(createRequest('/api/collections?visibility=PUBLIC'))

    expect(mockCollectionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ visibility: 'PUBLIC' }),
      })
    )
  })

  it('filters by visibility=INTERNAL when param is supplied', async () => {
    mockRequireAuth.mockResolvedValue(SESSION_AUTH)
    mockCollectionFindMany.mockResolvedValue([] as never)

    await GET(createRequest('/api/collections?visibility=INTERNAL'))

    expect(mockCollectionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ visibility: 'INTERNAL' }),
      })
    )
  })

  it('ignores an unrecognised visibility value (no visibility filter applied)', async () => {
    mockRequireAuth.mockResolvedValue(SESSION_AUTH)
    mockCollectionFindMany.mockResolvedValue([] as never)

    await GET(createRequest('/api/collections?visibility=BOGUS'))

    const whereArg = mockCollectionFindMany.mock.calls[0]![0] as { where: Record<string, unknown> }
    expect(whereArg.where.visibility).toBeUndefined()
  })

  it('filters by isArchived=true when param is supplied', async () => {
    mockRequireAuth.mockResolvedValue(SESSION_AUTH)
    mockCollectionFindMany.mockResolvedValue([] as never)

    await GET(createRequest('/api/collections?isArchived=true'))

    expect(mockCollectionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isArchived: true }),
      })
    )
  })

  it('defaults to isArchived=false when param is omitted', async () => {
    mockRequireAuth.mockResolvedValue(SESSION_AUTH)
    mockCollectionFindMany.mockResolvedValue([] as never)

    await GET(createRequest('/api/collections'))

    expect(mockCollectionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isArchived: false }),
      })
    )
  })
})

// ===========================================================================
// POST /api/collections
// ===========================================================================

describe('POST /api/collections', () => {
  it('returns 401 when requireAuth returns null', async () => {
    mockRequireAuth.mockResolvedValue(null)

    const res = await POST(postRequest({ title: 'New' }))

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body).toEqual({ error: 'Unauthorized' })
  })

  it('returns 403 when a VIEWER-role session user tries to create a collection', async () => {
    mockRequireAuth.mockResolvedValue(SESSION_AUTH)
    // member.findFirst returns null → user is not OWNER/ADMIN/EDITOR
    mockMemberFindFirst.mockResolvedValue(null)

    const res = await POST(postRequest({ title: 'Sneaky' }))

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body).toEqual({ error: 'Forbidden' })
  })

  it('creates a collection with the default folder emoji when none is provided', async () => {
    mockRequireAuth.mockResolvedValue(SESSION_AUTH)
    // User is EDITOR — role check passes
    mockMemberFindFirst.mockResolvedValue({ id: 'mem-1' } as never)
    mockCollectionFindFirst.mockResolvedValue(null) // no parent
    mockCollectionCount.mockResolvedValue(0)
    mockCollectionCreate.mockResolvedValue(COLLECTION_STUB as never)

    const res = await POST(postRequest({ title: 'Docs' }))

    expect(res.status).toBe(201)
    const createArg = mockCollectionCreate.mock.calls[0]![0] as { data: Record<string, unknown> }
    expect(createArg.data.emoji).toBe('📁')
  })

  it('uses the provided emoji when supplied', async () => {
    mockRequireAuth.mockResolvedValue(SESSION_AUTH)
    mockMemberFindFirst.mockResolvedValue({ id: 'mem-1' } as never)
    mockCollectionCount.mockResolvedValue(0)
    mockCollectionCreate.mockResolvedValue({ ...COLLECTION_STUB, emoji: '🚀' } as never)

    await POST(postRequest({ title: 'Docs', emoji: '🚀' }))

    const createArg = mockCollectionCreate.mock.calls[0]![0] as { data: Record<string, unknown> }
    expect(createArg.data.emoji).toBe('🚀')
  })

  it('returns 400 when title is empty string', async () => {
    mockRequireAuth.mockResolvedValue(SESSION_AUTH)
    mockMemberFindFirst.mockResolvedValue({ id: 'mem-1' } as never)

    const res = await POST(postRequest({ title: '' }))

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/Title is required/)
  })

  it('returns 400 when title is whitespace-only', async () => {
    mockRequireAuth.mockResolvedValue(SESSION_AUTH)
    mockMemberFindFirst.mockResolvedValue({ id: 'mem-1' } as never)

    const res = await POST(postRequest({ title: '   ' }))

    expect(res.status).toBe(400)
  })

  it('returns 404 when parentId does not belong to the workspace', async () => {
    mockRequireAuth.mockResolvedValue(SESSION_AUTH)
    mockMemberFindFirst.mockResolvedValue({ id: 'mem-1' } as never)
    // Parent lookup returns null — not found in this workspace
    mockCollectionFindFirst.mockResolvedValue(null)

    const res = await POST(postRequest({ title: 'Sub', parentId: 'col-nonexistent' }))

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toMatch(/Parent collection not found/)
  })

  it('returns 422 when nesting would exceed 3 levels (parentDepth >= 3)', async () => {
    mockRequireAuth.mockResolvedValue(SESSION_AUTH)
    mockMemberFindFirst.mockResolvedValue({ id: 'mem-1' } as never)
    // Parent exists in workspace
    mockCollectionFindFirst.mockResolvedValue({ id: 'col-parent' } as never)
    // getCollectionDepth: parent has a grandparent which has a great-grandparent → depth=3
    // The route calls prisma.collection.findUnique to walk the chain.
    // Simulate depth=3: parent → grandparent → root (no further parent)
    mockCollectionFindUnique
      .mockResolvedValueOnce({ parentId: 'col-grandparent' } as never) // parent depth call
      .mockResolvedValueOnce({ parentId: 'col-root' } as never)         // grandparent depth call
      .mockResolvedValueOnce({ parentId: null } as never)                // root depth call

    const res = await POST(postRequest({ title: 'Deep', parentId: 'col-parent' }))

    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error).toMatch(/Maximum nesting depth/)
  })

  it('retries with a suffixed slug on P2002 unique constraint violation', async () => {
    mockRequireAuth.mockResolvedValue(SESSION_AUTH)
    mockMemberFindFirst.mockResolvedValue({ id: 'mem-1' } as never)
    mockCollectionCount.mockResolvedValue(2)

    const p2002 = makePrismaP2002()
    mockCollectionCreate
      .mockRejectedValueOnce(p2002)
      .mockResolvedValueOnce({ ...COLLECTION_STUB, slug: 'docs-1' } as never)

    const res = await POST(postRequest({ title: 'Docs' }))

    expect(res.status).toBe(201)
    expect(mockCollectionCreate).toHaveBeenCalledTimes(2)

    const secondCall = mockCollectionCreate.mock.calls[1]![0] as { data: Record<string, unknown> }
    expect((secondCall.data.slug as string).endsWith('-1')).toBe(true)
  })

  it('allows api-key auth to create a collection (no session role check)', async () => {
    // API key auth has no userId → session role check is skipped entirely
    mockRequireAuth.mockResolvedValue(API_KEY_AUTH)
    mockCollectionCount.mockResolvedValue(0)
    mockCollectionCreate.mockResolvedValue(COLLECTION_STUB as never)

    const res = await POST(postRequest({ title: 'API Collection' }))

    expect(res.status).toBe(201)
    // member.findFirst should NOT have been called — no session userId to check
    expect(mockMemberFindFirst).not.toHaveBeenCalled()
  })

  it('sets order to the current sibling count so new collections append last', async () => {
    mockRequireAuth.mockResolvedValue(SESSION_AUTH)
    mockMemberFindFirst.mockResolvedValue({ id: 'mem-1' } as never)
    mockCollectionCount.mockResolvedValue(5) // 5 existing siblings
    mockCollectionCreate.mockResolvedValue(COLLECTION_STUB as never)

    await POST(postRequest({ title: 'Sixth' }))

    const createArg = mockCollectionCreate.mock.calls[0]![0] as { data: Record<string, unknown> }
    expect(createArg.data.order).toBe(5)
  })

  it('sets visibility to PUBLIC by default when param is omitted', async () => {
    mockRequireAuth.mockResolvedValue(SESSION_AUTH)
    mockMemberFindFirst.mockResolvedValue({ id: 'mem-1' } as never)
    mockCollectionCount.mockResolvedValue(0)
    mockCollectionCreate.mockResolvedValue(COLLECTION_STUB as never)

    await POST(postRequest({ title: 'Public Col' }))

    const createArg = mockCollectionCreate.mock.calls[0]![0] as { data: Record<string, unknown> }
    expect(createArg.data.visibility).toBe('PUBLIC')
  })

  it('sets visibility to INTERNAL when explicitly requested', async () => {
    mockRequireAuth.mockResolvedValue(SESSION_AUTH)
    mockMemberFindFirst.mockResolvedValue({ id: 'mem-1' } as never)
    mockCollectionCount.mockResolvedValue(0)
    mockCollectionCreate.mockResolvedValue({ ...COLLECTION_STUB, visibility: 'INTERNAL' } as never)

    await POST(postRequest({ title: 'Internal Col', visibility: 'INTERNAL' }))

    const createArg = mockCollectionCreate.mock.calls[0]![0] as { data: Record<string, unknown> }
    expect(createArg.data.visibility).toBe('INTERNAL')
  })
})
