import { vi, beforeEach, describe, it, expect } from 'vitest'

// ---------------------------------------------------------------------------
// Module mocks — must be declared before any imports that pull in these modules
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

// html-to-markdown is a pure function — mock it for predictable output
vi.mock('@/lib/html-to-markdown', () => ({
  htmlToMarkdown: vi.fn((s: string) => `md:${s}`),
}))

// ---------------------------------------------------------------------------
// Now import the subjects under test
// ---------------------------------------------------------------------------

import { GET, POST } from '@/app/api/articles/route'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth-api'
import { isCloudMode } from '@/lib/cloud'

// ---------------------------------------------------------------------------
// Prisma error factory — reproduces a P2002 unique-constraint violation
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

const mockRequireAuth = vi.mocked(requireAuth)
const mockArticleFindMany = vi.mocked(prisma.article.findMany)
const mockArticleCount = vi.mocked(prisma.article.count)
const mockArticleCreate = vi.mocked(prisma.article.create)
const mockCollectionFindFirst = vi.mocked(prisma.collection.findFirst)
const mockMemberFindFirst = vi.mocked(prisma.member.findFirst)
const mockIsCloudMode = vi.mocked(isCloudMode)

const WORKSPACE_ID = 'ws-123'
const USER_ID = 'user-456'

const AUTH_RESULT = { workspaceId: WORKSPACE_ID, userId: USER_ID, via: 'session' as const }

// A minimal article shape returned by prisma.article.findMany
const ARTICLE_STUB = {
  id: 'art-1',
  title: 'Hello World',
  slug: 'hello-world',
  excerpt: 'An excerpt',
  status: 'DRAFT',
  views: 0,
  publishedAt: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-02'),
  collection: { id: 'col-1', title: 'Getting Started', slug: 'getting-started' },
  author: { id: USER_ID, name: 'Alice', email: 'alice@example.com' },
}

beforeEach(() => {
  vi.clearAllMocks()
  mockIsCloudMode.mockReturnValue(false)
})

// ===========================================================================
// GET /api/articles
// ===========================================================================

describe('GET /api/articles', () => {
  it('returns 401 when requireAuth returns null', async () => {
    mockRequireAuth.mockResolvedValue(null)
    const req = createRequest('/api/articles')

    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body).toEqual({ error: 'Unauthorized' })
  })

  it('returns articles list with pagination metadata', async () => {
    mockRequireAuth.mockResolvedValue(AUTH_RESULT)
    mockArticleFindMany.mockResolvedValue([ARTICLE_STUB] as never)
    mockArticleCount.mockResolvedValue(1)

    const req = createRequest('/api/articles')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.total).toBe(1)
    expect(body.page).toBe(1)
    expect(body.limit).toBe(50)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].id).toBe('art-1')
  })

  it('filters by status query param', async () => {
    mockRequireAuth.mockResolvedValue(AUTH_RESULT)
    mockArticleFindMany.mockResolvedValue([] as never)
    mockArticleCount.mockResolvedValue(0)

    const req = createRequest('/api/articles?status=published')
    await GET(req)

    expect(mockArticleFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'PUBLISHED' }),
      })
    )
  })

  it('returns 400 for an invalid status value', async () => {
    mockRequireAuth.mockResolvedValue(AUTH_RESULT)

    const req = createRequest('/api/articles?status=INVALID')
    const res = await GET(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/Invalid status/)
  })

  it('filters by collection query param', async () => {
    mockRequireAuth.mockResolvedValue(AUTH_RESULT)
    mockArticleFindMany.mockResolvedValue([] as never)
    mockArticleCount.mockResolvedValue(0)

    const req = createRequest('/api/articles?collection=col-99')
    await GET(req)

    expect(mockArticleFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ collectionId: 'col-99' }),
      })
    )
  })

  it('filters by q (search) query param using case-insensitive title match', async () => {
    mockRequireAuth.mockResolvedValue(AUTH_RESULT)
    mockArticleFindMany.mockResolvedValue([] as never)
    mockArticleCount.mockResolvedValue(0)

    const req = createRequest('/api/articles?q=hello')
    await GET(req)

    expect(mockArticleFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          title: { contains: 'hello', mode: 'insensitive' },
        }),
      })
    )
  })

  it('respects page and limit params, computing skip correctly', async () => {
    mockRequireAuth.mockResolvedValue(AUTH_RESULT)
    mockArticleFindMany.mockResolvedValue([] as never)
    mockArticleCount.mockResolvedValue(0)

    const req = createRequest('/api/articles?page=3&limit=10')
    const res = await GET(req)

    const body = await res.json()
    expect(body.page).toBe(3)
    expect(body.limit).toBe(10)

    // skip = (3-1) * 10 = 20
    expect(mockArticleFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10 })
    )
  })

  it('clamps page to minimum 1 when a negative value is supplied', async () => {
    mockRequireAuth.mockResolvedValue(AUTH_RESULT)
    mockArticleFindMany.mockResolvedValue([] as never)
    mockArticleCount.mockResolvedValue(0)

    const req = createRequest('/api/articles?page=-5')
    const res = await GET(req)

    const body = await res.json()
    expect(body.page).toBe(1)
  })

  it('clamps limit to maximum 100 when an excessive value is supplied', async () => {
    mockRequireAuth.mockResolvedValue(AUTH_RESULT)
    mockArticleFindMany.mockResolvedValue([] as never)
    mockArticleCount.mockResolvedValue(0)

    const req = createRequest('/api/articles?limit=999')
    const res = await GET(req)

    const body = await res.json()
    expect(body.limit).toBe(100)
    expect(mockArticleFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 })
    )
  })

  it('clamps limit to minimum 1 when zero is supplied', async () => {
    mockRequireAuth.mockResolvedValue(AUTH_RESULT)
    mockArticleFindMany.mockResolvedValue([] as never)
    mockArticleCount.mockResolvedValue(0)

    const req = createRequest('/api/articles?limit=0')
    const res = await GET(req)

    const body = await res.json()
    expect(body.limit).toBe(1)
  })

  it('applies workspaceId from auth result to the where clause', async () => {
    mockRequireAuth.mockResolvedValue(AUTH_RESULT)
    mockArticleFindMany.mockResolvedValue([] as never)
    mockArticleCount.mockResolvedValue(0)

    const req = createRequest('/api/articles')
    await GET(req)

    expect(mockArticleFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ workspaceId: WORKSPACE_ID }),
      })
    )
    expect(mockArticleCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ workspaceId: WORKSPACE_ID }),
      })
    )
  })

  it('converts article content to markdown when format=markdown is requested', async () => {
    mockRequireAuth.mockResolvedValue(AUTH_RESULT)
    const articleWithContent = { ...ARTICLE_STUB, content: '<p>Hello</p>' }
    mockArticleFindMany.mockResolvedValue([articleWithContent] as never)
    mockArticleCount.mockResolvedValue(1)

    const req = createRequest('/api/articles?format=markdown')
    const res = await GET(req)

    const body = await res.json()
    // htmlToMarkdown mock returns `md:<input>`
    expect(body.data[0].content).toBe('md:<p>Hello</p>')
  })
})

// ===========================================================================
// POST /api/articles
// ===========================================================================

describe('POST /api/articles', () => {
  function postRequest(body: object): Request {
    return createRequest('/api/articles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  const CREATED_ARTICLE = {
    id: 'art-new',
    workspaceId: WORKSPACE_ID,
    collectionId: 'col-1',
    authorId: USER_ID,
    title: 'My Article',
    slug: 'my-article',
    content: '',
    excerpt: null,
    status: 'DRAFT',
    publishedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  it('returns 401 when requireAuth returns null', async () => {
    mockRequireAuth.mockResolvedValue(null)

    const res = await POST(postRequest({ title: 'Test' }))

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body).toEqual({ error: 'Unauthorized' })
  })

  it('creates an article with all provided fields and returns 201', async () => {
    mockRequireAuth.mockResolvedValue(AUTH_RESULT)
    mockCollectionFindFirst.mockResolvedValue({ id: 'col-1' } as never)
    mockArticleCreate.mockResolvedValue(CREATED_ARTICLE as never)

    const res = await POST(
      postRequest({
        title: 'My Article',
        content: '<p>Body</p>',
        excerpt: 'Short summary',
        collectionId: 'col-1',
        status: 'DRAFT',
      })
    )

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.id).toBe('art-new')

    expect(mockArticleCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: 'My Article',
          content: '<p>Body</p>',
          excerpt: 'Short summary',
          status: 'DRAFT',
          workspaceId: WORKSPACE_ID,
        }),
      })
    )
  })

  it("uses 'Untitled article' when title is empty", async () => {
    mockRequireAuth.mockResolvedValue(AUTH_RESULT)
    mockCollectionFindFirst.mockResolvedValue({ id: 'col-1' } as never)
    mockArticleCreate.mockResolvedValue({ ...CREATED_ARTICLE, title: 'Untitled article' } as never)

    await POST(postRequest({ title: '   ' }))

    expect(mockArticleCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ title: 'Untitled article' }),
      })
    )
  })

  it("uses 'Untitled article' when title is omitted entirely", async () => {
    mockRequireAuth.mockResolvedValue(AUTH_RESULT)
    mockCollectionFindFirst.mockResolvedValue({ id: 'col-1' } as never)
    mockArticleCreate.mockResolvedValue({ ...CREATED_ARTICLE, title: 'Untitled article' } as never)

    await POST(postRequest({}))

    expect(mockArticleCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ title: 'Untitled article' }),
      })
    )
  })

  it('falls back to first collection when collectionId is not provided', async () => {
    mockRequireAuth.mockResolvedValue(AUTH_RESULT)
    // First call: findFirst for default collection
    mockCollectionFindFirst.mockResolvedValue({ id: 'col-default' } as never)
    mockArticleCreate.mockResolvedValue({ ...CREATED_ARTICLE, collectionId: 'col-default' } as never)

    await POST(postRequest({ title: 'New article' }))

    // Should have queried for the default (first non-archived) collection
    expect(mockCollectionFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ workspaceId: WORKSPACE_ID, isArchived: false }),
      })
    )
    expect(mockArticleCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ collectionId: 'col-default' }),
      })
    )
  })

  it('returns 400 when no collection exists and none is provided', async () => {
    mockRequireAuth.mockResolvedValue(AUTH_RESULT)
    mockCollectionFindFirst.mockResolvedValue(null)

    const res = await POST(postRequest({ title: 'New article' }))

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/Create a collection first/)
  })

  it('returns 404 when provided collectionId does not belong to the workspace', async () => {
    mockRequireAuth.mockResolvedValue(AUTH_RESULT)
    // The route calls findFirst with { id: collectionId, workspaceId }
    mockCollectionFindFirst.mockResolvedValue(null)

    const res = await POST(postRequest({ title: 'New', collectionId: 'col-wrong-ws' }))

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toMatch(/Collection not found/)
  })

  it('sets publishedAt when status is PUBLISHED', async () => {
    mockRequireAuth.mockResolvedValue(AUTH_RESULT)
    mockCollectionFindFirst.mockResolvedValue({ id: 'col-1' } as never)
    mockArticleCreate.mockResolvedValue({
      ...CREATED_ARTICLE,
      status: 'PUBLISHED',
      publishedAt: new Date(),
    } as never)

    await POST(postRequest({ title: 'Go Live', collectionId: 'col-1', status: 'PUBLISHED' }))

    const createCall = mockArticleCreate.mock.calls[0]![0] as { data: Record<string, unknown> }
    expect(createCall.data.publishedAt).toBeDefined()
    expect(createCall.data.publishedAt).toBeInstanceOf(Date)
  })

  it('does not set publishedAt when status is DRAFT', async () => {
    mockRequireAuth.mockResolvedValue(AUTH_RESULT)
    mockCollectionFindFirst.mockResolvedValue({ id: 'col-1' } as never)
    mockArticleCreate.mockResolvedValue(CREATED_ARTICLE as never)

    await POST(postRequest({ title: 'Draft', collectionId: 'col-1', status: 'DRAFT' }))

    const createCall = mockArticleCreate.mock.calls[0]![0] as { data: Record<string, unknown> }
    expect(createCall.data.publishedAt).toBeUndefined()
  })

  it('retries with a slug suffix on P2002 unique constraint violation', async () => {
    mockRequireAuth.mockResolvedValue(AUTH_RESULT)
    mockCollectionFindFirst.mockResolvedValue({ id: 'col-1' } as never)

    // First attempt fails with P2002, second attempt succeeds
    const p2002 = makePrismaP2002()
    mockArticleCreate
      .mockRejectedValueOnce(p2002)
      .mockResolvedValueOnce({ ...CREATED_ARTICLE, slug: 'my-article-1' } as never)

    const res = await POST(postRequest({ title: 'My Article', collectionId: 'col-1' }))

    expect(res.status).toBe(201)
    expect(mockArticleCreate).toHaveBeenCalledTimes(2)

    // Second call should use a suffixed slug
    const secondCall = mockArticleCreate.mock.calls[1]![0] as { data: Record<string, unknown> }
    expect(secondCall.data.slug).toBe('my-article-1')
  })

  it('resolves authorId from first workspace member when session has no userId', async () => {
    // API key auth: userId is absent
    const apiKeyAuth = { workspaceId: WORKSPACE_ID, via: 'apikey' as const }
    mockRequireAuth.mockResolvedValue(apiKeyAuth)
    mockMemberFindFirst.mockResolvedValue({ userId: 'member-user-1' } as never)
    mockCollectionFindFirst.mockResolvedValue({ id: 'col-1' } as never)
    mockArticleCreate.mockResolvedValue(CREATED_ARTICLE as never)

    await POST(postRequest({ title: 'Via API key', collectionId: 'col-1' }))

    expect(mockMemberFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ workspaceId: WORKSPACE_ID }),
        orderBy: { id: 'asc' },
      })
    )
    expect(mockArticleCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ authorId: 'member-user-1' }),
      })
    )
  })

  it('returns 500 when there is no workspace member to use as author', async () => {
    const apiKeyAuth = { workspaceId: WORKSPACE_ID, via: 'apikey' as const }
    mockRequireAuth.mockResolvedValue(apiKeyAuth)
    mockMemberFindFirst.mockResolvedValue(null)

    const res = await POST(postRequest({ title: 'Orphan', collectionId: 'col-1' }))

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toMatch(/No workspace member found/)
  })
})
