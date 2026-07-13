import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AgentContext, AgentStreamEvent } from '@/lib/ai-agent'
import type { StreamEvent } from '@/lib/ai/types'

// ---------------------------------------------------------------------------
// Mocks — the agent's four external dependencies. Everything here is scripted
// so the tests exercise the escalation gate, not OpenAI/Qdrant/Postgres.
// ---------------------------------------------------------------------------

/** Rounds of provider output. Each round is one streamChat() call. */
let providerRounds: StreamEvent[][] = []

vi.mock('@/lib/ai/resolve-provider', () => ({
  resolveProvider: () => ({
    async *streamChat() {
      const round = providerRounds.shift() ?? []
      for (const event of round) {
        yield event
      }
    },
  }),
  isByok: () => false,
}))

/** Vector hits Qdrant will return: [{ articleId, score }]. */
let qdrantHits: Array<{ articleId: string; score: number }> = []
/** When true, embedText throws — simulating no OPENAI_API_KEY (lexical path). */
let embeddingsUnavailable = false

vi.mock('@/lib/embeddings', () => ({
  embedText: async () => {
    if (embeddingsUnavailable) throw new Error('OPENAI_API_KEY not configured')
    return new Array(1536).fill(0.1)
  },
}))

vi.mock('@/lib/qdrant', () => ({
  qdrant: {
    search: async () =>
      qdrantHits.map((hit, i) => ({
        id: `point-${i}`,
        version: 0,
        score: hit.score,
        payload: { articleId: hit.articleId },
      })),
  },
  COLLECTION_NAME: 'helpnest_articles',
  ensureCollection: async () => {},
}))

/** Rows the Postgres full-text fallback will return (with its coverage score). */
let fullTextRows: Array<Record<string, unknown>> = []

const article = (id: string) => ({
  id,
  title: `Article ${id}`,
  slug: `article-${id}`,
  content: 'Body content for the article.',
  collection: { slug: 'general', title: 'General' },
})

vi.mock('@/lib/db', () => ({
  prisma: {
    article: {
      findMany: async ({ where }: { where: { id: { in: string[] } } }) =>
        where.id.in.map((id) => article(id)),
    },
    conversationArticle: {
      upsert: () => ({ catch: () => Promise.resolve() }),
    },
    $queryRaw: async () => fullTextRows,
    knowledgeGap: { upsert: async () => null },
  },
}))

// Imported after the mocks are registered.
const { runAgent } = await import('@/lib/ai-agent')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const searchCall = (query = 'how do i reset my password'): StreamEvent => ({
  type: 'tool_call',
  name: 'search_articles',
  args: { query },
})

const reportCall = (score: unknown): StreamEvent => ({
  type: 'tool_call',
  name: 'report_confidence',
  args: { score, reasoning: 'because' },
})

const answer = (text = 'Here is your answer.'): StreamEvent[] => [{ type: 'text', text }]

function context(overrides: Partial<AgentContext> = {}): AgentContext {
  return {
    workspaceId: 'ws-1',
    workspaceName: 'Acme',
    conversationId: 'conv-1',
    aiProvider: null,
    aiApiKey: null,
    aiEscalationThreshold: 0.3,
    ...overrides,
  }
}

async function run(ctx: AgentContext = context()): Promise<AgentStreamEvent> {
  const events: AgentStreamEvent[] = []
  for await (const event of runAgent(ctx, [{ role: 'user', content: 'hello?' }])) {
    events.push(event)
  }
  const done = events.find((e) => e.type === 'done')
  if (!done) throw new Error('agent produced no done event')
  return done
}

beforeEach(() => {
  providerRounds = []
  qdrantHits = []
  fullTextRows = []
  embeddingsUnavailable = false
})

// ---------------------------------------------------------------------------
// The four cases from the bug report
// ---------------------------------------------------------------------------

describe('runAgent — silence must not read as confidence', () => {
  it('escalates an ungrounded answer when the model never calls report_confidence', async () => {
    // Nearest neighbour is noise (0.08 cosine), and the model volunteers no score.
    qdrantHits = [{ articleId: 'a1', score: 0.08 }]
    providerRounds = [[searchCall()], answer()]

    const done = await run()

    expect(done.confidence).toBe(0)
    expect(done.shouldEscalate).toBe(true)
  })

  it('does not silently mark an ungrounded answer resolved at 0.5', async () => {
    qdrantHits = [{ articleId: 'a1', score: 0.08 }]
    providerRounds = [[searchCall()], answer()]

    const done = await run()

    expect(done.confidence).not.toBe(0.5)
  })
})

describe('runAgent — a non-numeric score must not read as 0.5', () => {
  it('treats a non-numeric score as no report, leaving retrieval as the signal', async () => {
    // Retrieval is strong, so a correctly-ignored bad score yields full confidence.
    // If the bad score were coerced to 0.5, confidence would come back as 0.5.
    qdrantHits = [{ articleId: 'a1', score: 0.62 }]
    providerRounds = [[searchCall(), reportCall('high')], answer()]

    const done = await run()

    expect(done.confidence).toBe(1)
    expect(done.reportedConfidence).toBeNull()
    expect(done.shouldEscalate).toBe(false)
  })

  it('does not let a non-numeric score rescue a weakly-grounded answer', async () => {
    qdrantHits = [{ articleId: 'a1', score: 0.05 }]
    providerRounds = [[searchCall(), reportCall('very confident')], answer()]

    const done = await run()

    expect(done.confidence).toBe(0)
    expect(done.shouldEscalate).toBe(true)
  })
})

describe('runAgent — retrieval is the ceiling', () => {
  it('escalates a low-similarity match even when the model claims 0.95', async () => {
    qdrantHits = [{ articleId: 'a1', score: 0.08 }]
    providerRounds = [[searchCall(), reportCall(0.95)], answer()]

    const done = await run()

    expect(done.confidence).toBe(0)
    expect(done.reportedConfidence).toBe(0.95)
    expect(done.shouldEscalate).toBe(true)
  })

  it('lets the model lower confidence below what retrieval suggests', async () => {
    qdrantHits = [{ articleId: 'a1', score: 0.7 }]
    providerRounds = [[searchCall(), reportCall(0.1)], answer()]

    const done = await run()

    expect(done.confidence).toBe(0.1)
    expect(done.shouldEscalate).toBe(true)
  })

  it('resolves a well-grounded answer the model is also confident about', async () => {
    qdrantHits = [{ articleId: 'a1', score: 0.7 }]
    providerRounds = [[searchCall(), reportCall(0.9)], answer()]

    const done = await run()

    expect(done.confidence).toBe(0.9)
    expect(done.shouldEscalate).toBe(false)
  })

  it('scores a search that found nothing as zero grounding', async () => {
    qdrantHits = []
    fullTextRows = []
    providerRounds = [[searchCall(), reportCall(0.9)], answer()]

    const done = await run()

    expect(done.confidence).toBe(0)
    expect(done.shouldEscalate).toBe(true)
  })

  it('keeps the best retrieval across multiple searches in one turn', async () => {
    // First search grounds well; a throwaway second search must not tank it.
    qdrantHits = [{ articleId: 'a1', score: 0.7 }]
    providerRounds = [[searchCall('billing')], [searchCall('unrelated follow-up')], answer()]
    const done = await run()

    expect(done.shouldEscalate).toBe(false)
  })
})

describe('runAgent — a greeting must not escalate or create a knowledge gap', () => {
  it('returns null confidence when the agent never searched', async () => {
    providerRounds = [answer('Hi! How can I help?')]

    const done = await run()

    expect(done.confidence).toBeNull()
    expect(done.shouldEscalate).toBe(false)
    expect(done.sources).toEqual([])
  })

  it('returns null confidence even if the model volunteers a score without searching', async () => {
    providerRounds = [[reportCall(0.2)], answer('Hi! How can I help?')]

    const done = await run()

    expect(done.confidence).toBeNull()
    expect(done.shouldEscalate).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Behaviour that must not regress
// ---------------------------------------------------------------------------

describe('runAgent — preserved behaviour', () => {
  it('honours the documented kill switch: threshold 0 disables auto-escalation', async () => {
    qdrantHits = [{ articleId: 'a1', score: 0.01 }]
    providerRounds = [[searchCall(), reportCall(0)], answer()]

    const done = await run(context({ aiEscalationThreshold: 0 }))

    expect(done.confidence).toBe(0)
    expect(done.shouldEscalate).toBe(false)
  })

  it('always escalates when the model explicitly calls escalate_to_human', async () => {
    qdrantHits = [{ articleId: 'a1', score: 0.9 }]
    providerRounds = [
      [
        searchCall(),
        reportCall(0.95),
        { type: 'tool_call', name: 'escalate_to_human', args: { reason: 'customer asked' } },
      ],
      answer(),
    ]

    const done = await run()

    expect(done.shouldEscalate).toBe(true)
    expect(done.escalationReason).toContain('customer asked')
  })

  it('ignores the retrieval ceiling when grounding is disabled for the workspace', async () => {
    qdrantHits = [{ articleId: 'a1', score: 0.05 }]
    providerRounds = [[searchCall(), reportCall(0.95)], answer()]

    const done = await run(context({ aiGroundingEnabled: false }))

    expect(done.confidence).toBe(0.95)
    expect(done.shouldEscalate).toBe(false)
  })

  it('still returns the retrieved articles as sources', async () => {
    qdrantHits = [
      { articleId: 'a1', score: 0.7 },
      { articleId: 'a2', score: 0.5 },
    ]
    providerRounds = [[searchCall()], answer()]

    const done = await run()

    expect(done.sources?.map((s) => s.id)).toEqual(['a1', 'a2'])
  })
})

// ---------------------------------------------------------------------------
// The lexical fallback — a different retriever, graded on its own signal
// ---------------------------------------------------------------------------

describe('runAgent — full-text fallback', () => {
  it('escalates when lexical coverage is below the lexical floor', async () => {
    embeddingsUnavailable = true
    // The question had many content words; the best article contains one of them.
    fullTextRows = [{ ...article('a1'), coverage: 0.17 }]
    providerRounds = [[searchCall(), reportCall(0.9)], answer()]

    const done = await run()

    expect(done.retrievalMode).toBe('lexical')
    expect(done.confidence).toBe(0)
    expect(done.shouldEscalate).toBe(true)
  })

  it('resolves when lexical coverage is high', async () => {
    embeddingsUnavailable = true
    fullTextRows = [{ ...article('a1'), coverage: 1 }]
    providerRounds = [[searchCall(), reportCall(0.9)], answer()]

    const done = await run()

    expect(done.retrievalMode).toBe('lexical')
    expect(done.confidence).toBe(0.9)
    expect(done.shouldEscalate).toBe(false)
  })

  it('does not grade lexical coverage against the cosine floor', async () => {
    embeddingsUnavailable = true
    // 0.3 coverage clears the 0.20 cosine floor but not the 0.34 lexical floor.
    fullTextRows = [{ ...article('a1'), coverage: 0.3 }]
    providerRounds = [[searchCall()], answer()]

    const done = await run()

    expect(done.confidence).toBe(0)
    expect(done.shouldEscalate).toBe(true)
  })
})
