/**
 * Integration test: the full-text retriever's lexical coverage query.
 *
 * This file deliberately does NOT mock @/lib/db. The coverage score is computed in
 * raw SQL (tsvector_to_array / unnest / plainto_tsquery), and a mocked $queryRaw
 * would happily return whatever we told it to — proving nothing about whether the
 * query parses, whether float8 division comes back as a JS number, or whether the
 * CROSS JOIN produces one row per article. Those are exactly the failures that only
 * appear in production. So this runs against the real helpnest_test database.
 *
 * Embeddings are mocked to throw, which is what forces the lexical path — the same
 * thing that happens on a self-hosted install with no OPENAI_API_KEY.
 */

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { testDb, createTestWorkspace, registerTestDbTeardown } from '@/test/harness'

vi.mock('@/lib/embeddings', () => ({
  embedText: async () => {
    throw new Error('OPENAI_API_KEY not configured')
  },
}))

registerTestDbTeardown()

const { searchArticles } = await import('@/lib/ai-agent')

let workspaceId: string
const createdIds: string[] = []

beforeAll(async () => {
  const workspace = await createTestWorkspace('fulltext')
  workspaceId = workspace.workspaceId

  const collection = await testDb.collection.create({
    data: {
      workspaceId,
      title: 'Account',
      slug: `account-${Date.now()}`,
      visibility: 'PUBLIC',
      isArchived: false,
    },
  })

  const article = await testDb.article.create({
    data: {
      workspaceId,
      collectionId: collection.id,
      title: 'Resetting your password',
      slug: `resetting-your-password-${Date.now()}`,
      content:
        'To reset your password, open the login page and choose "Forgot password". ' +
        'We email you a reset link that expires after one hour.',
      status: 'PUBLISHED',
      authorId: workspace.userId,
    },
  })
  createdIds.push(article.id)
})

afterAll(async () => {
  await testDb.article.deleteMany({ where: { id: { in: createdIds } } })
})

describe('searchArticles — full-text fallback against a real database', () => {
  it('returns the matching article with a real lexical coverage score', async () => {
    const result = await searchArticles('how do I reset my password', workspaceId)

    expect(result.signal.mode).toBe('lexical')
    expect(result.articles.map((a) => a.title)).toContain('Resetting your password')

    // "how do I reset my password" reduces to the lexemes {reset, password} after
    // stopword removal, and both appear in the article — so coverage should be high.
    // The assertion that matters is that this is a REAL number in [0, 1], because a
    // Postgres float8 that came back as a string or NaN would silently score 0 and
    // escalate every conversation on the lexical path.
    expect(typeof result.signal.coverage).toBe('number')
    expect(result.signal.coverage).toBeGreaterThan(0.5)
    expect(result.signal.coverage).toBeLessThanOrEqual(1)
    expect(result.signal.topScore).toBeNull()
  })

  it('reports no retrieval when nothing matches the query', async () => {
    const result = await searchArticles('how long should I boil an egg', workspaceId)

    expect(result.articles).toEqual([])
    expect(result.signal.mode).toBe('none')
    expect(result.signal.coverage).toBeNull()
  })

  it('does not leak articles from other workspaces', async () => {
    const other = await createTestWorkspace('fulltext-other')
    const result = await searchArticles('how do I reset my password', other.workspaceId)

    expect(result.articles).toEqual([])
    expect(result.signal.mode).toBe('none')
  })
})
