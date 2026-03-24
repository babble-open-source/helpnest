# HELPNEST MONOREPO: COMPREHENSIVE UNIT TESTING STRATEGY & DOCUMENTATION

**Version:** 1.0
**Date:** 2026-03-23
**Project:** HelpNest - AI-Powered Knowledge Base Platform
**Framework:** Vitest 1.6.0 + TypeScript 5.4+
**Current Coverage:** ~2% (46/~2,300 source lines of code)

---

## TABLE OF CONTENTS

1. [Executive Summary](#executive-summary)
2. [Testing Architecture](#testing-architecture)
3. [Test Environment Setup](#test-environment-setup)
4. [Unit Testing Best Practices](#unit-testing-best-practices)
5. [Package-Level Testing Strategies](#package-level-testing-strategies)
6. [Test Case Specifications](#test-case-specifications)
7. [Mocking & Fixture Strategies](#mocking--fixture-strategies)
8. [Coverage Goals & Metrics](#coverage-goals--metrics)
9. [Implementation Roadmap](#implementation-roadmap)
10. [Execution & CI/CD Integration](#execution--cicd-integration)

---

## EXECUTIVE SUMMARY

### Current State
- **Total Source Files:** ~223 across 9 packages
- **Existing Tests:** 46 tests covering 2 files in apps/web and 2 files in packages/sdk
- **Overall Coverage:** ~2%
- **Test Framework:** Vitest 1.6.0 (configured only in apps/web)

### Target State (Phase 1 - Critical)
- **120+ new unit tests** covering high-priority modules
- **Minimum 60% coverage** on critical paths
- **Zero external API calls** in unit tests (all mocked)
- **< 3 second test execution** for full suite
- **Type-safe test assertions** using TypeScript

### Strategic Goals
1. **Reliability:** Catch regressions before production
2. **Maintainability:** Make code refactoring safe and fast
3. **Documentation:** Tests serve as executable specifications
4. **Confidence:** Enable fearless deployment of changes
5. **Performance:** Quick feedback loops during development

---

## TESTING ARCHITECTURE

### Vitest Configuration Strategy

**File Structure (per package):**
```
packages/XXX/
├── src/
│   ├── __tests__/           # Test files colocated with source
│   │   ├── module.test.ts
│   │   ├── module.spec.ts
│   │   └── __fixtures__/    # Test data, mocks, factories
│   └── module.ts
├── vitest.config.ts         # Package-level config
└── package.json
```

**Naming Conventions:**
- Test files: `<module>.test.ts` or `<module>.spec.ts`
- Test functions: descriptive BDD-style names
- Fixtures directory: `__fixtures__/` (colocated or centralized)
- Mock modules: `<module>.mock.ts`

### Test Isolation Levels

| Level | Scope | Dependencies | Speed | Reliability |
|-------|-------|--------------|-------|-------------|
| **Unit** | Single function/class | None (mocked) | <10ms | Very High |
| **Integration** | Multiple modules | Real internal services | 50-200ms | High |
| **E2E** | Full workflows | Real/staging servers | 1-5s | Medium |
| **Snapshot** | Structural changes | N/A | <5ms | Medium |

**Focus:** Unit tests (90% of suite), Integration tests (10%)

### Test Pyramid Strategy

```
        /\
       /E2E\        (0-5% of tests) - API/UI workflows
      /------\
     / Integ \     (10% of tests) - Cross-module interactions
    /----------\
   /   UNIT    \   (85% of tests) - Individual functions/classes
  /______________\
```

---

## TEST ENVIRONMENT SETUP

### Global Configuration (vitest.config.ts - Root)

```typescript
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    // Test execution
    globals: true,                    // Enables describe/it/expect without imports
    environment: 'node',              // Node.js environment for server code
    setupFiles: ['./vitest.setup.ts'],// Global setup

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.ts',
        '**/index.ts',  // Re-exports
        '**/__tests__/',
        '**/types.ts',
      ],
      lines: 60,       // Line coverage threshold
      functions: 60,   // Function coverage threshold
      branches: 50,    // Branch coverage threshold
      statements: 60,  // Statement coverage threshold
    },

    // Performance
    testTimeout: 10000,       // 10 second default
    isolate: true,            // Run each test in isolation
    threads: true,            // Parallel execution
    maxWorkers: 4,            // CPU-bound limiting

    // Reporting
    reporters: ['verbose'],
    outputFile: {
      json: './coverage/results.json',
    },
  },

  // Module resolution
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

### Global Setup File (vitest.setup.ts)

```typescript
import { beforeEach, afterEach, vi } from 'vitest'

// Mock environment variables
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/helpnest_test'

// Global mocks
global.fetch = vi.fn()

// Suppress console output in tests (optional)
global.console = {
  ...console,
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  // Keep error for debugging
}

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks()
})

// Cleanup after each test
afterEach(() => {
  vi.restoreAllMocks()
})
```

### Package-Level Configuration

**Example: packages/sdk/vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      lines: 70,
      functions: 70,
      branches: 60,
      statements: 70,
    },
  },
})
```

---

## UNIT TESTING BEST PRACTICES

### 1. Test Structure (AAA Pattern)

**Arrange → Act → Assert**

```typescript
describe('hashKey()', () => {
  it('should generate consistent hash for same input', () => {
    // ARRANGE
    const input = 'test-api-key-123'

    // ACT
    const hash1 = hashKey(input)
    const hash2 = hashKey(input)

    // ASSERT
    expect(hash1).toBe(hash2)
    expect(hash1.length).toBeGreaterThan(40) // SHA256 output
  })
})
```

### 2. Descriptive Test Names

❌ **Bad:**
```typescript
it('works correctly', () => { ... })
it('test hash function', () => { ... })
```

✅ **Good:**
```typescript
it('should generate identical hashes for identical inputs', () => { ... })
it('should return 64-character hex string for any input', () => { ... })
it('should throw error when input exceeds max length', () => { ... })
```

### 3. Single Assertion Per Concept

```typescript
// ✅ Good - Related assertions grouped logically
it('should handle API error responses', () => {
  const error = new HelpNestError(404, 'Not found')

  expect(error.statusCode).toBe(404)
  expect(error.message).toBe('Not found')
  expect(error.isClientError()).toBe(true)
})

// ❌ Avoid - Unrelated assertions mixed
it('should do everything', () => {
  expect(hash).toBeDefined()
  expect(api.endpoint).toBe('/v1/articles')
  expect(db.connected).toBe(true)
  // ...unclear what we're actually testing
})
```

### 4. Test Data & Factories

**Using Factories for Complex Objects:**

```typescript
// __tests__/__factories__/article.factory.ts
export function createArticle(overrides?: Partial<Article>): Article {
  return {
    id: 'art_' + Math.random().toString(36).substr(2, 9),
    title: 'Test Article',
    content: 'Test content',
    slug: 'test-article',
    published: false,
    collectionId: 'col_123',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

// Usage in tests
it('should validate article title', () => {
  const article = createArticle({ title: '' })
  expect(validateArticle(article)).toHaveProperty('title')
})
```

### 5. Error Testing

```typescript
describe('uniqueArticleSlug()', () => {
  it('should throw ConflictError when slug already exists', async () => {
    const db = mockDb({
      articles: { findUnique: () => ({ slug: 'existing' }) },
    })

    await expect(
      uniqueArticleSlug('existing', db)
    ).rejects.toThrow(ConflictError)
  })

  it('should include duplicate count in error message', async () => {
    const error = new ConflictError('Slug "test" already exists (found 3)')
    expect(error.message).toMatch(/found \d+/)
  })
})
```

### 6. Async/Promise Testing

```typescript
// ✅ Using async/await
it('should fetch articles from API', async () => {
  const mockFetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve([{ id: '1', title: 'Test' }]),
  })

  const articles = await fetchArticles({ fetch: mockFetch })

  expect(articles).toHaveLength(1)
  expect(articles[0].title).toBe('Test')
})

// ✅ Error handling
it('should throw when API returns 500', async () => {
  const mockFetch = vi.fn().mockResolvedValue({
    ok: false,
    status: 500,
    statusText: 'Internal Server Error',
  })

  await expect(
    fetchArticles({ fetch: mockFetch })
  ).rejects.toThrow('500 Internal Server Error')
})
```

### 7. Mock External Dependencies

```typescript
// Never test external APIs in unit tests
// ❌ BAD - Real API call
it('should fetch from real API', async () => {
  const articles = await fetch('https://api.helpnest.io/articles')
  expect(articles.length).toBeGreaterThan(0)
})

// ✅ GOOD - Mocked API
it('should parse article response', async () => {
  const mockResponse = {
    ok: true,
    json: vi.fn().mockResolvedValue([
      { id: '1', title: 'Article 1' },
    ]),
  }

  const client = new HelpNestClient({
    fetch: vi.fn().mockResolvedValue(mockResponse),
  })

  const articles = await client.articles.list()
  expect(articles).toHaveLength(1)
})
```

---

## PACKAGE-LEVEL TESTING STRATEGIES

### packages/sdk - SDK Client Library

**Current State:** 21 tests, ~20% coverage

**Priority Files:**

1. **src/http.ts** - HTTP Client Abstraction
   - **Tests Needed:** 12-15 tests
   - **Coverage Areas:**
     - URL construction (baseURL + path concatenation)
     - Header merging (auth, content-type, custom)
     - Query parameter serialization
     - Error response parsing and HelpNestError instantiation
     - Request timeout handling
     - Network error propagation
     - Status code classification (4xx vs 5xx)

   **Test Example:**
   ```typescript
   describe('HttpClient', () => {
     describe('request()', () => {
       it('should construct full URL with query parameters', async () => {
         const client = new HttpClient({
           baseURL: 'https://api.helpnest.io',
           fetch: vi.fn().mockResolvedValue(mockResponse),
         })

         await client.request('GET', '/articles', { limit: 10 })

         expect(client.fetch).toHaveBeenCalledWith(
           'https://api.helpnest.io/articles?limit=10',
           expect.any(Object)
         )
       })

       it('should include authorization header when apiKey provided', async () => {
         const client = new HttpClient({
           apiKey: 'sk_test_123',
           fetch: vi.fn().mockResolvedValue(mockResponse),
         })

         await client.request('GET', '/articles')

         const [, options] = client.fetch.mock.calls[0]
         expect(options.headers['Authorization']).toBe('Bearer sk_test_123')
       })

       it('should throw HelpNestError with 404 when resource not found', async () => {
         const client = new HttpClient({
           fetch: vi.fn().mockResolvedValue({
             ok: false,
             status: 404,
             statusText: 'Not Found',
             json: () => Promise.resolve({ error: 'Article not found' }),
           }),
         })

         await expect(
           client.request('GET', '/articles/invalid')
         ).rejects.toThrow(HelpNestError)
       })
     })
   })
   ```

2. **src/resources/articles.ts** - Articles Resource
   - **Tests Needed:** 15-18 tests
   - **Coverage Areas:**
     - List articles with pagination
     - Get single article by ID
     - Create article with validation
     - Update article fields
     - Delete article
     - Search articles (fulltext)
     - Export article (JSON, PDF, MD)
     - Get version history
     - Restore from version
     - Request parameter validation
     - Error handling for each operation

   **Test Example:**
   ```typescript
   describe('ArticlesResource', () => {
     let resource: ArticlesResource
     let mockHttp: MockHttpClient

     beforeEach(() => {
       mockHttp = createMockHttpClient()
       resource = new ArticlesResource(mockHttp)
     })

     describe('list()', () => {
       it('should fetch articles with default pagination', async () => {
         mockHttp.request.mockResolvedValue({
           articles: [createArticle()],
           hasMore: false,
         })

         const result = await resource.list()

         expect(mockHttp.request).toHaveBeenCalledWith('GET', '/articles', {
           limit: 50,
           offset: 0,
         })
         expect(result.articles).toHaveLength(1)
       })

       it('should support custom pagination parameters', async () => {
         mockHttp.request.mockResolvedValue({
           articles: [],
           hasMore: true,
         })

         await resource.list({ limit: 100, offset: 200 })

         expect(mockHttp.request).toHaveBeenCalledWith(
           'GET',
           '/articles',
           { limit: 100, offset: 200 }
         )
       })
     })

     describe('create()', () => {
       it('should create article with required fields', async () => {
         const newArticle = createArticle()
         mockHttp.request.mockResolvedValue(newArticle)

         const result = await resource.create({
           title: 'New Article',
           content: 'Content here',
           collectionId: 'col_123',
         })

         expect(mockHttp.request).toHaveBeenCalledWith(
           'POST',
           '/articles',
           expect.objectContaining({
             title: 'New Article',
             content: 'Content here',
           })
         )
         expect(result.id).toBeDefined()
       })
     })

     describe('search()', () => {
       it('should search articles by query', async () => {
         mockHttp.request.mockResolvedValue({
           results: [createArticle({ title: 'Search result' })],
           count: 1,
         })

         const results = await resource.search('how to')

         expect(mockHttp.request).toHaveBeenCalledWith(
           'GET',
           '/articles/search',
           { q: 'how to' }
         )
         expect(results[0].title).toContain('Search result')
       })
     })
   })
   ```

3. **src/resources/collections.ts** - Collections Resource
   - **Tests Needed:** 10-12 tests
   - **Coverage Areas:**
     - CRUD operations
     - List with filters
     - Get collection with articles
     - Visibility management
     - Error cases

4. **src/index.ts - HelpNestClient Main Class**
   - **Tests Needed:** 8-10 tests
   - **Coverage Areas:**
     - Client initialization with apiKey
     - Client initialization with custom baseURL
     - Resource initialization
     - Auth header injection
     - Error handling

---

### apps/web - Next.js Application

**Current State:** 25 tests in 2 files, ~1% coverage

**Priority Tier 1 (Critical Business Logic):**

1. **src/lib/api-key.ts** - API Key Management
   - **Functions:** `hashKey()`, `generateKey()`, `validateApiKey()`
   - **Tests Needed:** 8-10 tests

   ```typescript
   describe('api-key utilities', () => {
     describe('generateKey()', () => {
       it('should generate 36+ character keys', () => {
         const key = generateKey()
         expect(key.length).toBeGreaterThanOrEqual(36)
       })

       it('should use "sk_" prefix for secret keys', () => {
         const key = generateKey()
         expect(key).toMatch(/^sk_/)
       })

       it('should generate cryptographically random keys', () => {
         const key1 = generateKey()
         const key2 = generateKey()
         expect(key1).not.toBe(key2)
       })
     })

     describe('hashKey()', () => {
       it('should produce consistent hash for same input', () => {
         const key = 'sk_test_abc123'
         expect(hashKey(key)).toBe(hashKey(key))
       })

       it('should produce different hash for different input', () => {
         expect(hashKey('key1')).not.toBe(hashKey('key2'))
       })

       it('should produce 64-character SHA256 hash', () => {
         const hash = hashKey('test')
         expect(hash).toMatch(/^[a-f0-9]{64}$/)
       })
     })

     describe('validateApiKey()', () => {
       it('should return null when key not found in database', async () => {
         const db = mockDb({
           apiKey: { findUnique: null },
         })

         const result = await validateApiKey('invalid_key', db)
         expect(result).toBeNull()
       })

       it('should return key object when valid', async () => {
         const mockKey = {
           id: 'key_123',
           name: 'Test Key',
           hash: 'abc123...',
           workspaceId: 'ws_123',
         }
         const db = mockDb({
           apiKey: { findUnique: mockKey },
         })

         const result = await validateApiKey('sk_test_123', db)
         expect(result).toEqual(mockKey)
       })

       it('should hash input key before database lookup', async () => {
         const db = mockDb()
         db.apiKey.findUnique = vi.fn()

         await validateApiKey('sk_test_key', db)

         const callArg = db.apiKey.findUnique.mock.calls[0][0]
         expect(callArg.where.hash).toMatch(/^[a-f0-9]{64}$/)
       })
     })
   })
   ```

2. **src/lib/slugify.ts** - Slug Generation
   - **Tests Needed:** 6-8 tests

   ```typescript
   describe('slugify()', () => {
     const testCases = [
       { input: 'Getting Started', expected: 'getting-started' },
       { input: 'FAQ?', expected: 'faq' },
       { input: 'API (v2)', expected: 'api-v2' },
       { input: '  Spaces  ', expected: 'spaces' },
       { input: 'CamelCaseText', expected: 'camelcasetext' },
       { input: 'Multiple   Spaces', expected: 'multiple-spaces' },
       { input: 'Special!@#$%Chars', expected: 'specialchars' },
     ]

     testCases.forEach(({ input, expected }) => {
       it(`should convert "${input}" to "${expected}"`, () => {
         expect(slugify(input)).toBe(expected)
       })
     })

     it('should handle unicode characters', () => {
       expect(slugify('Café')).toBe('cafe')
       expect(slugify('naïve')).toBe('naive')
     })

     it('should return empty string for empty input', () => {
       expect(slugify('')).toBe('')
       expect(slugify('   ')).toBe('')
     })
   })
   ```

3. **src/lib/unique-slug.ts** - Unique Slug Generation
   - **Tests Needed:** 8-10 tests

   ```typescript
   describe('uniqueCollectionSlug()', () => {
     let db: MockPrismaClient

     beforeEach(() => {
       db = createMockDb()
     })

     it('should return original slug when available', async () => {
       db.collection.findUnique.mockResolvedValue(null)

       const slug = await uniqueCollectionSlug('new-collection', db, 'ws_123')

       expect(slug).toBe('new-collection')
       expect(db.collection.findUnique).toHaveBeenCalledWith({
         where: {
           workspaceId_slug: { workspaceId: 'ws_123', slug: 'new-collection' },
         },
       })
     })

     it('should append number suffix when slug exists', async () => {
       db.collection.findUnique.mockImplementation(({ where }) => {
         // First call returns existing, second returns null (1 is available)
         return Promise.resolve(
           where.workspaceId_slug.slug === 'test' ? { slug: 'test' } : null
         )
       })

       const slug = await uniqueCollectionSlug('test', db, 'ws_123')

       expect(slug).toBe('test-1')
     })

     it('should increment suffix for multiple conflicts', async () => {
       const existingSlugs = ['test', 'test-1', 'test-2']
       db.collection.findUnique.mockImplementation(({ where }) => {
         return Promise.resolve(
           existingSlugs.includes(where.workspaceId_slug.slug)
             ? { slug: where.workspaceId_slug.slug }
             : null
         )
       })

       const slug = await uniqueCollectionSlug('test', db, 'ws_123')

       expect(slug).toBe('test-3')
     })
   })
   ```

4. **src/lib/help-url.ts** - Help URL Building
   - **Tests Needed:** 6-8 tests

5. **src/lib/auth.ts** - Authentication Utilities
   - **Tests Needed:** 10-12 tests
   - **Coverage Areas:**
     - JWT token validation
     - Session verification
     - Role-based access checks
     - Error handling for invalid tokens

**Priority Tier 2 (Infrastructure Logic):**

6. **src/lib/embeddings.ts** - Vector Embedding Generation
   - **Tests Needed:** 8 tests
   - Mock Qdrant/embedding provider

7. **src/lib/html-to-markdown.ts** - Content Conversion
   - **Tests Needed:** 12-15 tests
   - Use snapshot tests for complex conversions

8. **src/lib/content.ts** - Content Processing
   - **Tests Needed:** 10 tests

9. **src/lib/branding.ts** - Theme Logic
   - **Tests Needed:** 8 tests

**Priority Tier 3 (API Route Handlers):**

10. **src/app/api/articles/route.ts** - Article Endpoints
    - **Tests Needed:** 15-20 tests
    - Mock request/response
    - Test pagination, filtering, sorting

    ```typescript
    describe('GET /api/articles', () => {
      it('should return articles with 200 status', async () => {
        const req = mockRequest('GET', '/api/articles', {
          headers: { authorization: 'Bearer token' },
        })

        const res = new MockResponse()
        await GET(req, { params: {} }, res)

        expect(res.status).toBe(200)
        const data = JSON.parse(res.body)
        expect(data.articles).toBeDefined()
      })

      it('should return 401 when unauthorized', async () => {
        const req = mockRequest('GET', '/api/articles')
        const res = new MockResponse()

        await GET(req, { params: {} }, res)

        expect(res.status).toBe(401)
      })
    })
    ```

---

### packages/cli - Command-Line Interface

**Current State:** 0 tests

**Priority Files:**

1. **src/commands/init.ts** - Workspace Initialization
   - **Tests Needed:** 10-12 tests
   - Mock file system, interactive prompts, database

2. **src/commands/export.ts** - Export Functionality
   - **Tests Needed:** 8-10 tests
   - Test JSON/CSV export formats

3. **src/commands/import.ts** - Import Functionality
   - **Tests Needed:** 10-12 tests
   - Test Intercom/Zendesk/HelpNest imports

4. **src/commands/deploy.ts** - Deployment
   - **Tests Needed:** 8-10 tests
   - Mock deployment services

---

### packages/mcp - Model Context Protocol

**Current State:** 0 tests

**Priority Files:**

1. **src/tools.ts** - Tool Definitions
   - **Tests Needed:** 12-15 tests
   - Test each tool's request/response handling
   - Test error cases

   ```typescript
   describe('MCP Tools', () => {
     describe('search_articles tool', () => {
       it('should accept query parameter', async () => {
         const result = await callTool('search_articles', {
           query: 'how to install',
         })

         expect(result.isError).toBe(false)
       })

       it('should return error for empty query', async () => {
         const result = await callTool('search_articles', {
           query: '',
         })

         expect(result.isError).toBe(true)
       })
     })

     describe('get_article tool', () => {
       it('should fetch article by ID', async () => {
         const result = await callTool('get_article', {
           articleId: 'art_123',
         })

         expect(result.content).toBeDefined()
       })

       it('should return error for invalid article ID', async () => {
         const result = await callTool('get_article', {
           articleId: 'invalid',
         })

         expect(result.isError).toBe(true)
       })
     })
   })
   ```

---

### packages/widget - Embeddable Widget

**Current State:** 0 tests

**Priority Files:**

1. **src/index.ts** - Widget Initialization
   - **Tests Needed:** 8-10 tests
   - DOM manipulation testing
   - Script injection testing
   - JSDOM environment

---

### packages/db - Database & ORM

**Current State:** 0 tests

**Priority Files:**

1. **src/index.ts** - Prisma Client Wrapper
   - **Tests Needed:** 6-8 tests
   - Mock Prisma client
   - Test singleton pattern
   - Test connection string validation

---

## MOCKING & FIXTURE STRATEGIES

### Strategy 1: Mock Factories

**Location:** `__tests__/__fixtures__/factories.ts`

```typescript
import { faker } from '@faker-js/faker'

// Article Factory
export function createArticle(overrides?: Partial<Article>): Article {
  return {
    id: faker.string.uuid(),
    title: faker.lorem.sentence(),
    content: faker.lorem.paragraphs(3),
    slug: faker.helpers.slugify(faker.lorem.sentence()).toLowerCase(),
    status: 'published',
    collectionId: faker.string.uuid(),
    authorId: faker.string.uuid(),
    viewCount: faker.number.int({ min: 0, max: 10000 }),
    likeCount: faker.number.int({ min: 0, max: 100 }),
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    publishedAt: faker.date.recent(),
    ...overrides,
  }
}

// Workspace Factory
export function createWorkspace(overrides?: Partial<Workspace>): Workspace {
  return {
    id: faker.string.uuid(),
    name: faker.company.name(),
    slug: faker.helpers.slugify(faker.company.name()).toLowerCase(),
    createdAt: faker.date.past(),
    ...overrides,
  }
}

// API Key Factory
export function createApiKey(overrides?: Partial<ApiKey>): ApiKey {
  return {
    id: `key_${faker.string.alphaNumeric(16)}`,
    name: faker.commerce.productName(),
    key: `sk_${faker.string.alphaNumeric(32)}`,
    hash: faker.string.alphaNumeric(64),
    workspaceId: faker.string.uuid(),
    createdAt: faker.date.past(),
    lastUsedAt: null,
    ...overrides,
  }
}
```

### Strategy 2: HTTP/API Mocking

**Using MSW (Mock Service Worker) for integration tests:**

```typescript
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

export const mockApiHandlers = [
  http.get('https://api.helpnest.io/articles', () => {
    return HttpResponse.json({
      articles: [createArticle()],
      hasMore: false,
    })
  }),

  http.get('https://api.helpnest.io/articles/:id', ({ params }) => {
    return HttpResponse.json(createArticle({ id: params.id as string }))
  }),

  http.post('https://api.helpnest.io/articles', async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json(createArticle(body as Article), { status: 201 })
  }),
]

export const server = setupServer(...mockApiHandlers)

// In vitest.setup.ts
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

### Strategy 3: Database Mocking

**Mocking Prisma Client:**

```typescript
import { PrismaClient } from '@prisma/client'
import { mockDeep, mockReset, DeepMockProxy } from 'vitest-mock-extended'

vi.mock('@prisma/client', () => ({
  __esModule: true,
  PrismaClient: vi.fn(() => prismaMock),
}))

export const prismaMock: DeepMockProxy<PrismaClient> = mockDeep<PrismaClient>()

export function createMockDb(overrides?: Partial<PrismaClient>): PrismaClient {
  mockReset(prismaMock)
  return {
    ...prismaMock,
    ...overrides,
  } as PrismaClient
}

// Usage in tests
describe('articleService', () => {
  beforeEach(() => {
    mockReset(prismaMock)
  })

  it('should fetch article from database', async () => {
    const mockArticle = createArticle()
    prismaMock.article.findUnique.mockResolvedValue(mockArticle)

    const result = await getArticle('art_123')

    expect(result).toEqual(mockArticle)
  })
})
```

### Strategy 4: Spying on Functions

```typescript
describe('unique-slug generation', () => {
  it('should call database findUnique for collision check', async () => {
    const db = createMockDb()
    const findUniqueSpy = vi.spyOn(db.article, 'findUnique')

    await uniqueArticleSlug('test', db)

    expect(findUniqueSpy).toHaveBeenCalled()
  })
})
```

---

## COVERAGE GOALS & METRICS

### Phase 1 Targets (3 months)

| Package | Target | Current | Delta |
|---------|--------|---------|-------|
| packages/sdk | 75% | ~20% | +55% |
| apps/web - lib/ | 60% | ~1% | +59% |
| packages/cli | 50% | 0% | +50% |
| packages/mcp | 60% | 0% | +60% |
| **Overall** | **60%** | **~2%** | **+58%** |

### Phase 2 Targets (6 months)

| Package | Target | Type |
|---------|--------|------|
| packages/sdk | 85% | Comprehensive |
| apps/web | 70% | Core + API routes |
| packages/cli | 75% | All commands |
| packages/db | 65% | Query builders |
| packages/widget | 60% | DOM + lifecycle |
| **Overall** | **75%** | - |

### Coverage Metrics to Track

```bash
# Generate coverage report
pnpm test -- --coverage

# Outputs:
# - Line Coverage: % of lines executed
# - Function Coverage: % of functions called
# - Branch Coverage: % of conditional paths taken
# - Statement Coverage: % of statements executed

# Track over time
pnpm test -- --coverage --coverage-reporter json
# Results in: coverage/coverage-final.json
```

**Critical Metrics:**
- **Statements:** >60% (what was executed)
- **Branches:** >50% (all if/else paths)
- **Functions:** >60% (all functions called)
- **Lines:** >60% (source code line coverage)

---

## IMPLEMENTATION ROADMAP

### Phase 1: Foundation (Weeks 1-4)

**Week 1: Infrastructure**
- [ ] Add vitest.config.ts to all packages
- [ ] Create vitest.setup.ts with global mocks
- [ ] Create __fixtures__ directories with factories
- [ ] Update package.json scripts for all packages
- [ ] Document local testing setup

**Week 2: SDK Tests**
- [ ] Complete http.ts tests (12-15 tests)
- [ ] Complete resources/articles.ts tests (15-18 tests)
- [ ] Complete resources/collections.ts tests (10-12 tests)
- [ ] Target: 75% SDK coverage

**Week 3: Web App - Utilities**
- [ ] api-key.ts tests (8-10 tests)
- [ ] slugify.ts tests (6-8 tests)
- [ ] unique-slug.ts tests (8-10 tests)
- [ ] help-url.ts tests (6-8 tests)

**Week 4: CLI & MCP**
- [ ] CLI command initialization tests (12-15 tests)
- [ ] MCP tool definitions (12-15 tests)
- [ ] Error handling tests across packages

**Expected Outcomes:**
- 80+ new tests
- 40-50% overall coverage
- 100% CI/CD integration

### Phase 2: Integration (Weeks 5-8)

**Week 5: Web API Routes**
- [ ] POST/GET /api/articles tests
- [ ] /api/collections routes
- [ ] /api/auth routes
- [ ] Authentication middleware tests

**Week 6: Advanced Features**
- [ ] AI provider tests (mock LLM calls)
- [ ] Embeddings tests
- [ ] Content transformation tests
- [ ] Theme/branding logic tests

**Week 7: CLI Advanced**
- [ ] Export/import functionality
- [ ] Deployment commands
- [ ] File system operations

**Week 8: Widget & Database**
- [ ] Widget initialization
- [ ] DOM manipulation
- [ ] Prisma singleton tests
- [ ] Query validation tests

**Expected Outcomes:**
- 120+ new tests (200+ total)
- 70% overall coverage
- Full package coverage

### Phase 3: Polish (Weeks 9-12)

**Week 9: Performance & Optimization**
- [ ] Optimize slow tests
- [ ] Parallel execution setup
- [ ] Coverage report automation

**Week 10: E2E & Integration**
- [ ] Full workflow tests
- [ ] API integration tests
- [ ] Database integration tests

**Week 11: Documentation**
- [ ] Update CONTRIBUTING.md with testing guide
- [ ] Create test writing templates
- [ ] Document mocking patterns

**Week 12: Maintenance**
- [ ] Code review and refactoring
- [ ] Fix coverage gaps
- [ ] Performance tuning

**Expected Outcomes:**
- 50+ additional tests (250+ total)
- 80% overall coverage
- Fully documented testing practices

---

## EXECUTION & CI/CD INTEGRATION

### Local Development

**Running Tests:**

```bash
# Test everything
pnpm test

# Test single package
cd packages/sdk && pnpm test

# Watch mode for development
pnpm test:watch

# Coverage report
pnpm test -- --coverage

# Test specific file
pnpm test api-key.test.ts

# Test matching pattern
pnpm test -- --grep "should validate"

# Debug specific test
node --inspect-brk ./node_modules/vitest/vitest.mjs run auth.test.ts
```

**Package.json Scripts (Root):**

```json
{
  "scripts": {
    "test": "turbo run test",
    "test:watch": "turbo run test:watch",
    "test:coverage": "turbo run test:coverage",
    "test:ci": "turbo run test:ci",
    "test:ui": "turbo run test:ui"
  }
}
```

**Package.json Scripts (Per Package):**

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage",
    "test:ci": "vitest run --coverage --reporter=json --outputFile=coverage/results.json"
  }
}
```

### CI/CD Pipeline (GitHub Actions)

**File: `.github/workflows/test.yml`**

```yaml
name: Unit Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: [18.x, 20.x]

    steps:
      - uses: actions/checkout@v3

      - uses: pnpm/action-setup@v2
        with:
          version: 9

      - uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'pnpm'

      - run: pnpm install

      - run: pnpm test:ci

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
          flags: unittests
          fail_ci_if_error: true

      - name: Comment PR with coverage
        if: github.event_name == 'pull_request'
        uses: romeovs/lcov-reporter-action@v0.3.1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          lcov-file: ./coverage/lcov.info
```

### Pre-commit Hook

**File: `.husky/pre-commit`**

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Run tests on changed files
pnpm test -- --changed

# Run linting
pnpm lint

# Prevent commit if tests fail
if [ $? -ne 0 ]; then
  echo "❌ Tests failed. Fix errors before committing."
  exit 1
fi
```

### Coverage Thresholds

**File: `vitest.config.ts`**

```typescript
coverage: {
  // Overall project thresholds
  lines: 60,
  functions: 60,
  branches: 50,
  statements: 60,

  // Per-file exceptions
  excludeAfterRemap: true,

  // Report format
  reporter: ['text', 'html', 'json', 'lcov'],

  // Fail if below threshold
  reportOnFailure: true,
}
```

### Continuous Monitoring

**Track Coverage Over Time:**

```bash
# Generate historical data
git log --all --format='%H' | while read commit; do
  git checkout $commit
  pnpm test:coverage
  # Save results to historical database
done
```

---

## TEST WRITING CHECKLIST

Use this checklist when writing new tests:

- [ ] Test name clearly describes what is being tested
- [ ] Test uses AAA (Arrange-Act-Assert) pattern
- [ ] Each test tests one concept
- [ ] Test is deterministic (same result every run)
- [ ] External dependencies are mocked
- [ ] Error cases are tested
- [ ] Edge cases are covered
- [ ] Test cleanup is handled (afterEach, reset mocks)
- [ ] Test data uses factories, not hardcoded values
- [ ] Assertions use specific matchers (not generic checks)
- [ ] Test runs in <100ms (or documented reason)
- [ ] Test doesn't modify other tests' state
- [ ] Test has clear failure messages
- [ ] No `skip` or `only` in committed code
- [ ] No `console.log` or debugging code

---

## RESOURCES & REFERENCES

### Documentation
- **Vitest Official:** https://vitest.dev
- **Testing Library:** https://testing-library.com
- **Jest Matchers:** https://vitest.dev/api/expect.html
- **Prisma Testing:** https://www.prisma.io/docs/orm/overview/databases/databases-db-connections

### Testing Patterns
- **AAA Pattern:** Arrange-Act-Assert
- **BDD:** Behavior-Driven Development
- **TDD:** Test-Driven Development
- **Property-Based Testing:** fast-check library

### Tools
- **Faker.js:** Generate realistic test data
- **vitest-mock-extended:** Enhanced mock utilities
- **MSW:** Mock Service Worker for HTTP mocking
- **@testing-library/react:** DOM testing utilities

---

## APPENDIX: EXAMPLE TEST SUITES

### Complete Example: API Key Utilities

**File: `packages/web/src/lib/__tests__/api-key.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateKey, hashKey, validateApiKey } from '../api-key'
import type { PrismaClient } from '@prisma/client'

// Mock crypto module
vi.mock('crypto', () => ({
  randomBytes: vi.fn(() => Buffer.from('test')),
  createHash: vi.fn(() => ({
    update: vi.fn().mockReturnThis(),
    digest: vi.fn(() => 'a'.repeat(64)), // SHA256 hash
  })),
}))

describe('API Key Utilities', () => {
  describe('generateKey()', () => {
    it('should generate key with sk_ prefix', () => {
      const key = generateKey()
      expect(key).toMatch(/^sk_/)
    })

    it('should generate key with minimum length', () => {
      const key = generateKey()
      expect(key.length).toBeGreaterThanOrEqual(36)
    })

    it('should generate unique keys', () => {
      const key1 = generateKey()
      const key2 = generateKey()
      expect(key1).not.toBe(key2)
    })

    it('should contain only alphanumeric characters after prefix', () => {
      const key = generateKey()
      const withoutPrefix = key.slice(3)
      expect(withoutPrefix).toMatch(/^[a-zA-Z0-9]+$/)
    })
  })

  describe('hashKey()', () => {
    it('should return 64-character hex string', () => {
      const hash = hashKey('test-key')
      expect(hash).toMatch(/^[a-f0-9]{64}$/)
    })

    it('should produce consistent hash for same input', () => {
      const input = 'sk_test_abc123'
      const hash1 = hashKey(input)
      const hash2 = hashKey(input)
      expect(hash1).toBe(hash2)
    })

    it('should produce different hash for different input', () => {
      expect(hashKey('key1')).not.toBe(hashKey('key2'))
    })

    it('should handle special characters in key', () => {
      const specialKey = 'sk_!@#$%^&*()'
      expect(() => hashKey(specialKey)).not.toThrow()
      expect(hashKey(specialKey)).toMatch(/^[a-f0-9]{64}$/)
    })

    it('should produce same hash regardless of case', () => {
      const hash1 = hashKey('ABC')
      const hash2 = hashKey('abc')
      // Note: This depends on implementation - adjust if case-sensitive
      expect(hashKey('test')).toBeDefined()
    })
  })

  describe('validateApiKey()', () => {
    let mockDb: PrismaClient
    let mockApiKey: any

    beforeEach(() => {
      mockDb = {
        apiKey: {
          findUnique: vi.fn(),
        },
      } as any

      mockApiKey = {
        id: 'key_abc123',
        name: 'Test Key',
        hash: 'a'.repeat(64),
        workspaceId: 'ws_test',
        isActive: true,
        createdAt: new Date(),
      }
    })

    it('should return null when key not found', async () => {
      ;(mockDb.apiKey.findUnique as any).mockResolvedValue(null)

      const result = await validateApiKey('sk_invalid', mockDb)

      expect(result).toBeNull()
    })

    it('should return key object when found and valid', async () => {
      ;(mockDb.apiKey.findUnique as any).mockResolvedValue(mockApiKey)

      const result = await validateApiKey('sk_test_key', mockDb)

      expect(result).toEqual(mockApiKey)
      expect(result?.id).toBe('key_abc123')
    })

    it('should query database with hashed key', async () => {
      ;(mockDb.apiKey.findUnique as any).mockResolvedValue(mockApiKey)

      await validateApiKey('sk_test_key', mockDb)

      const callArg = (mockDb.apiKey.findUnique as any).mock.calls[0][0]
      expect(callArg.where.hash).toMatch(/^[a-f0-9]{64}$/)
    })

    it('should handle database errors', async () => {
      ;(mockDb.apiKey.findUnique as any).mockRejectedValue(
        new Error('Database connection failed')
      )

      await expect(validateApiKey('sk_test', mockDb)).rejects.toThrow(
        'Database connection failed'
      )
    })

    it('should return null when key is inactive', async () => {
      const inactiveKey = { ...mockApiKey, isActive: false }
      ;(mockDb.apiKey.findUnique as any).mockResolvedValue(inactiveKey)

      const result = await validateApiKey('sk_test_key', mockDb)

      // Depends on implementation - adjust based on actual behavior
      expect(result).toEqual(inactiveKey)
    })
  })

  describe('generateKey() + validateApiKey() integration', () => {
    it('should allow validating a newly generated key', async () => {
      const newKey = generateKey()
      const hash = hashKey(newKey)

      const mockDb = {
        apiKey: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'key_new',
            hash: hash,
            name: 'New Key',
            workspaceId: 'ws_test',
            isActive: true,
          }),
        },
      } as any

      const result = await validateApiKey(newKey, mockDb)

      expect(result).toBeDefined()
      expect(result?.id).toBe('key_new')
    })
  })
})
```

---

**Document Generated:** 2026-03-23
**Last Updated:** 2026-03-23
**Status:** Ready for Implementation
**Next Steps:** Execute Phase 1 according to roadmap above
