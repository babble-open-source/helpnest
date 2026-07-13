/**
 * Integration test: knowledge gap clustering against the real database.
 *
 * @/lib/db is NOT mocked — the upserts, the unique constraint, and the Float[]
 * embedding column all run against helpnest_test. The embedding and the judge ARE
 * mocked, because the point of these tests is the DECISION LOGIC, not OpenAI.
 *
 * The test that matters most is the opposite-intent one. Measured on
 * text-embedding-3-small, "upgrade my plan" and "downgrade my plan" score 0.79 —
 * HIGHER than most genuine paraphrases. Any cosine threshold that merges real
 * duplicates also merges those two, which would corrupt the occurrence count and
 * auto-draft one article for two opposite questions. The judge is what prevents it,
 * and this file is where that is nailed down.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { testDb, createTestWorkspace, registerTestDbTeardown } from '@/test/harness'

/** Embedding returned for the next query, keyed by the query text. */
const embeddings = new Map<string, number[]>()
let embeddingsAvailable = true

vi.mock('@/lib/embeddings', () => ({
  embedText: async (text: string) => {
    if (!embeddingsAvailable) throw new Error('OPENAI_API_KEY not configured')
    return embeddings.get(text) ?? [1, 0, 0]
  },
}))

/** What the judge replies. 'NONE' = not a duplicate. */
let judgeReply = 'NONE'
let judgeCalls = 0

vi.mock('@/lib/ai/resolve-provider', () => ({
  resolveProvider: () => ({
    async *streamChat() {
      judgeCalls++
      yield { type: 'text' as const, text: judgeReply }
    },
  }),
  isByok: () => false,
}))

registerTestDbTeardown()

const { recordKnowledgeGap } = await import('@/lib/ai-agent')

let workspaceId: string

beforeEach(async () => {
  const workspace = await createTestWorkspace('gaps')
  workspaceId = workspace.workspaceId
  // The judge needs a workspace row with AI settings to resolve a provider.
  await testDb.workspace.update({
    where: { id: workspaceId },
    data: { aiProvider: 'ANTHROPIC', aiApiKey: 'test-key' },
  })
  embeddings.clear()
  embeddingsAvailable = true
  judgeReply = 'NONE'
  judgeCalls = 0
})

// No afterAll cleanup: registerTestDbTeardown() truncates, and each test creates its
// own workspace so gaps cascade away with it. A manual deleteMany here raced the
// harness truncate and deadlocked.

async function gapCount(): Promise<number> {
  return testDb.knowledgeGap.count({ where: { workspaceId } })
}

describe('recordKnowledgeGap — exact matches', () => {
  it('increments rather than duplicating an identical question', async () => {
    const first = await recordKnowledgeGap(workspaceId, 'How do I reset my password?')
    const second = await recordKnowledgeGap(workspaceId, '  how do i   RESET my password? ')

    expect(first?.id).toBe(second?.id)
    expect(second?.occurrences).toBe(2)
    expect(await gapCount()).toBe(1)
  })

  it('takes the exact path without paying for an embedding or the judge', async () => {
    await recordKnowledgeGap(workspaceId, 'how do i reset my password')
    judgeCalls = 0

    await recordKnowledgeGap(workspaceId, 'how do i reset my password')

    expect(judgeCalls).toBe(0)
  })
})

describe('recordKnowledgeGap — semantic clustering', () => {
  it('merges a paraphrase the hash cannot see, when the judge confirms it', async () => {
    embeddings.set('how do i reset my password', [1, 0, 0])
    embeddings.set('i forgot my password', [0.95, 0.31, 0])

    const first = await recordKnowledgeGap(workspaceId, 'how do i reset my password')
    judgeReply = '1' // the judge agrees one article answers both
    const second = await recordKnowledgeGap(workspaceId, 'i forgot my password')

    expect(second?.id).toBe(first?.id)
    expect(second?.occurrences).toBe(2)
    expect(await gapCount()).toBe(1)
  })

  it('does NOT merge opposite intents, even at a higher cosine than a real paraphrase', async () => {
    // These two vectors are 0.98 similar — well above anything a threshold could
    // exclude — and they are opposite questions. Cosine alone would merge them.
    embeddings.set('how do i upgrade my plan', [1, 0, 0])
    embeddings.set('how do i downgrade my plan', [0.98, 0.2, 0])

    const first = await recordKnowledgeGap(workspaceId, 'how do i upgrade my plan')
    judgeReply = 'NONE' // the judge sees the polarity the embedding lost
    const second = await recordKnowledgeGap(workspaceId, 'how do i downgrade my plan')

    expect(second?.id).not.toBe(first?.id)
    expect(second?.occurrences).toBe(1)
    expect(await gapCount()).toBe(2)
  })

  it('does not merge when the judge returns garbage', async () => {
    embeddings.set('how do i upgrade my plan', [1, 0, 0])
    embeddings.set('how do i downgrade my plan', [0.98, 0.2, 0])

    await recordKnowledgeGap(workspaceId, 'how do i upgrade my plan')
    judgeReply = 'maybe? possibly the same thing'
    await recordKnowledgeGap(workspaceId, 'how do i downgrade my plan')

    expect(await gapCount()).toBe(2)
  })

  it('never asks the judge when nothing clears the candidate floor', async () => {
    embeddings.set('how do i upgrade my plan', [1, 0, 0])
    embeddings.set('where are my invoices', [0, 1, 0]) // orthogonal — not a candidate

    await recordKnowledgeGap(workspaceId, 'how do i upgrade my plan')
    judgeCalls = 0
    await recordKnowledgeGap(workspaceId, 'where are my invoices')

    expect(judgeCalls).toBe(0)
    expect(await gapCount()).toBe(2)
  })
})

describe('recordKnowledgeGap — degraded environments', () => {
  it('falls back to exact-match only when embeddings are unavailable', async () => {
    // A self-hosted install with no OPENAI_API_KEY. Clustering is simply off; the
    // old behaviour must still work rather than throwing.
    embeddingsAvailable = false

    const first = await recordKnowledgeGap(workspaceId, 'how do i reset my password')
    const paraphrase = await recordKnowledgeGap(workspaceId, 'i forgot my password')
    const repeat = await recordKnowledgeGap(workspaceId, 'how do i reset my password')

    expect(paraphrase?.id).not.toBe(first?.id) // no clustering without embeddings
    expect(repeat?.id).toBe(first?.id) // exact match still dedups
    expect(repeat?.occurrences).toBe(2)
    expect(judgeCalls).toBe(0)
  })

  it('stores the embedding so the gap can be matched semantically later', async () => {
    embeddings.set('how do i reset my password', [0.1, 0.2, 0.3])

    const gap = await recordKnowledgeGap(workspaceId, 'how do i reset my password')
    const row = await testDb.knowledgeGap.findUnique({
      where: { id: gap!.id },
      select: { embedding: true },
    })

    expect(row?.embedding).toEqual([0.1, 0.2, 0.3])
  })
})
