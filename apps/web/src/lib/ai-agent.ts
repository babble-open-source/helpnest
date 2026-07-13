/**
 * ai-agent.ts — Core AI agent for conversational customer support.
 *
 * Orchestrates a multi-turn tool-use loop over the provider abstraction:
 *   1. Agent calls search_articles to retrieve relevant KB content.
 *   2. Agent calls report_confidence to declare its certainty level.
 *   3. Agent either answers the customer or calls escalate_to_human.
 *
 * The generator yields StreamEvents (text deltas for the SSE layer) plus a
 * single final 'done' event carrying metadata: sources, confidence, and
 * escalation status. Callers should forward text events directly to the
 * response stream and consume the done payload for persistence.
 *
 * Never import a provider SDK directly here — always go through resolveProvider.
 */

import crypto from 'crypto'
import { resolveProvider } from '@/lib/ai/resolve-provider'
import type { ChatMessage, StreamEvent, ToolDefinition } from '@/lib/ai/types'
import { prisma } from '@/lib/db'
import { embedText } from '@/lib/embeddings'
import {
  DEFAULT_LEXICAL_FLOOR,
  DEFAULT_RETRIEVAL_FLOOR,
  effectiveConfidence,
  parseReportedConfidence,
  retrievalConfidence,
  shouldEscalate as shouldEscalateOn,
} from '@/lib/ai-grounding'
import type { GroundingFloors, RetrievalMode, RetrievalSignal } from '@/lib/ai-grounding'
import { qdrant, COLLECTION_NAME, ensureCollection } from '@/lib/qdrant'
import type { CollectionVisibility } from '@helpnest/db'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface AgentContext {
  workspaceId: string
  workspaceName: string
  conversationId: string
  /** Stored provider slug, e.g. 'anthropic' | 'openai' | 'google'. null = default. */
  aiProvider: string | null
  /** Encrypted API key from the workspace row. null = fall back to env var. */
  aiApiKey: string | null
  /** Optional model override. Providers fall back to their default when null. */
  aiModel?: string | null
  /** Custom instructions from the workspace's AI settings. */
  aiInstructions?: string | null
  /**
   * Confidence threshold below which the agent auto-escalates. 0–1.
   * Typical default: 0.3. Set to 0 to disable auto-escalation.
   */
  aiEscalationThreshold: number
  /**
   * When false, retrieval is not used as a ceiling on the model's self-reported
   * confidence — the workspace opts out of the grounding gate and reverts to
   * self-report alone. Defaults to true.
   */
  aiGroundingEnabled?: boolean
  /** Cosine floor for the vector retriever. null = use the conservative default. */
  aiRetrievalFloor?: number | null
  /** Coverage floor for the full-text retriever. null = use the conservative default. */
  aiLexicalFloor?: number | null
  /** Whether to include internal articles in search. false for widget, true for dashboard. */
  includeInternal?: boolean
}

export interface AgentResponse {
  content: string
  sources: ArticleSource[]
  /** Effective confidence, or null when the agent never searched (nothing to ground). */
  confidence: number | null
  shouldEscalate: boolean
  escalationReason?: string
}

export interface ArticleSource {
  id: string
  title: string
  slug: string
  collection: { slug: string; title: string }
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface ArticleRow {
  id: string
  title: string
  slug: string
  content: string
  collection: { slug: string; title: string }
}

/** A full-text row carries its own lexical coverage score alongside the article. */
interface FullTextRow extends ArticleRow {
  coverage: number | null
}

/**
 * What a single search_articles call actually retrieved, plus how well it
 * matched. The signal is what the escalation gate is built on — see ai-grounding.ts.
 */
interface RetrievalResult {
  articles: ArticleRow[]
  signal: RetrievalSignal
}

/**
 * The generator return type extends StreamEvent with optional metadata fields
 * that are only present on the terminal 'done' event. Keeping this as a union
 * (rather than a separate type) means callers can use a single discriminated
 * switch on `event.type`.
 */
export type AgentStreamEvent = StreamEvent & {
  sources?: ArticleSource[]
  /**
   * Effective confidence for the turn. null means the agent never searched, so
   * there is no grounding to judge — callers must NOT compare this with `<`
   * against a threshold (JS coerces null to 0); use shouldEscalate().
   */
  confidence?: number | null
  /**
   * The grounding breakdown behind `confidence`, persisted so operators can
   * later audit both failure modes: answers that were grounded but wrong, and
   * escalations raised while a good article existed (over-abstention).
   */
  reportedConfidence?: number | null
  retrievalMode?: RetrievalMode
  retrievalScore?: number | null
  shouldEscalate?: boolean
  escalationReason?: string
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

const AGENT_TOOLS: ToolDefinition[] = [
  {
    name: 'search_articles',
    description:
      'Search the help center knowledge base for articles relevant to the customer question. ' +
      'Use this to find information before answering.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query to find relevant help articles',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'report_confidence',
    description:
      'Report your confidence level in the answer you are about to give. ' +
      'Call this BEFORE responding to the customer. ' +
      'Score 0-1 where 0 = no relevant information found, 0.3 = partial information, ' +
      '0.7 = good match, 1.0 = exact answer in articles.',
    parameters: {
      type: 'object',
      properties: {
        score: {
          type: 'number',
          description: 'Confidence score from 0.0 to 1.0',
        },
        reasoning: {
          type: 'string',
          description: 'Brief explanation of why you gave this confidence score',
        },
      },
      required: ['score', 'reasoning'],
    },
  },
  {
    name: 'escalate_to_human',
    description:
      'Escalate this conversation to a human support agent. ' +
      'Use when you cannot find a good answer, the customer explicitly requests a human, ' +
      'or the question requires account-specific actions you cannot perform.',
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Why the conversation is being escalated',
        },
      },
      required: ['reason'],
    },
  },
]

// ---------------------------------------------------------------------------
// Article search — wraps the existing RAG pipeline
// ---------------------------------------------------------------------------

const NO_RETRIEVAL: RetrievalSignal = { mode: 'none', topScore: null, coverage: null }

/**
 * Retrieves up to 5 published articles matching `query` for the given workspace,
 * together with a signal describing HOW WELL they matched.
 *
 * Strategy:
 *   1. Attempt OpenAI embedding + Qdrant vector search (preserves semantic ranking).
 *   2. Fall back to PostgreSQL full-text search if embeddings or Qdrant are unavailable.
 *
 * The two paths do NOT produce the same measurement, and the signal says which
 * one ran so the caller can grade each against its own floor:
 *
 *   - vector:  cosine similarity of the best surviving match (the collection is
 *              created with distance: 'Cosine' — see lib/qdrant.ts).
 *   - lexical: the fraction of the question's content lexemes that appear in the
 *              best matching article. ts_rank_cd is deliberately NOT used as a
 *              confidence — it is unbounded and varies with corpus and query
 *              length, so it is a ranking, not a similarity. Coverage is bounded
 *              in [0, 1] and means something a human can check.
 *
 * Both paths filter to published articles in public, non-archived collections so the
 * agent can never surface draft or restricted content to customers.
 */
export async function searchArticles(
  query: string,
  workspaceId: string,
  includeInternal = false
): Promise<RetrievalResult> {
  const allowedVisibility: CollectionVisibility[] = includeInternal
    ? ['PUBLIC', 'INTERNAL']
    : ['PUBLIC']

  // --- Vector path ---
  let queryEmbedding: number[] = []
  try {
    queryEmbedding = await embedText(query)
  } catch {
    // OPENAI_API_KEY not configured or network error — proceed to full-text.
  }

  if (queryEmbedding.length > 0) {
    try {
      await ensureCollection()
      // Use must_not to exclude INTERNAL (rather than requiring PUBLIC) so
      // legacy vectors without a visibility field still pass through.
      const qdrantFilter: {
        must: Array<{ key: string; match: { value: string } }>
        must_not?: Array<{ key: string; match: { value: string } }>
      } = {
        must: [{ key: 'workspaceId', match: { value: workspaceId } }],
      }
      if (!includeInternal) {
        qdrantFilter.must_not = [{ key: 'visibility', match: { value: 'INTERNAL' } }]
      }
      const results = await qdrant.search(COLLECTION_NAME, {
        vector: queryEmbedding,
        limit: 5,
        filter: qdrantFilter,
        with_payload: true,
      })

      // Deduplicate: a single article may have multiple chunk points in Qdrant.
      // We preserve the order of first appearance (highest similarity first) and
      // keep each article's best chunk score.
      const bestScoreByArticle = new Map<string, number>()
      const articleIds: string[] = []
      for (const result of results) {
        const articleId = result.payload?.['articleId']
        if (typeof articleId !== 'string') continue
        const score = typeof result.score === 'number' ? result.score : 0
        const existing = bestScoreByArticle.get(articleId)
        if (existing === undefined) {
          bestScoreByArticle.set(articleId, score)
          articleIds.push(articleId)
        } else if (score > existing) {
          bestScoreByArticle.set(articleId, score)
        }
      }

      if (articleIds.length > 0) {
        const rows: ArticleRow[] = await prisma.article.findMany({
          where: {
            id: { in: articleIds },
            workspaceId,
            status: 'PUBLISHED',
            collection: { is: { visibility: { in: allowedVisibility }, isArchived: false } },
          },
          select: {
            id: true,
            title: true,
            slug: true,
            content: true,
            collection: { select: { slug: true, title: true } },
          },
        })

        // Re-order to match vector similarity ranking (Prisma findMany doesn't
        // guarantee ORDER BY ... IN list ordering).
        const byId = new Map(rows.map((r) => [r.id, r]))
        const articles = articleIds
          .map((id) => byId.get(id))
          .filter((r): r is ArticleRow => r !== undefined)

        // Score the best SURVIVING article, not the best raw vector hit. A hit
        // whose article is draft/archived/out-of-scope is filtered out above and
        // must not be allowed to vouch for the answer the customer actually gets.
        if (articles.length === 0) {
          return { articles: [], signal: NO_RETRIEVAL }
        }
        const topScore = Math.max(...articles.map((a) => bestScoreByArticle.get(a.id) ?? 0))
        return { articles, signal: { mode: 'vector', topScore, coverage: null } }
      }
    } catch {
      // Qdrant unavailable — fall through to full-text.
    }
  }

  // --- Full-text fallback ---
  //
  // `coverage` = |query lexemes present in the article| / |query lexemes|.
  // to_tsvector strips stopwords, so "how do I reset my password" reduces to
  // {reset, password} and we measure against the words that carry meaning.
  const rows = await prisma.$queryRaw<FullTextRow[]>`
    WITH q AS (
      SELECT tsvector_to_array(to_tsvector('english', ${query})) AS terms
    )
    SELECT a.id, a.title, a.slug, a.content,
           json_build_object('slug', c.slug, 'title', c.title) AS collection,
           CASE
             WHEN COALESCE(array_length(q.terms, 1), 0) = 0 THEN 0::float8
             ELSE (
               SELECT COUNT(*)::float8
               FROM   unnest(q.terms) AS term
               WHERE  term = ANY(
                        tsvector_to_array(to_tsvector('english', a.title || ' ' || a.content))
                      )
             ) / array_length(q.terms, 1)::float8
           END AS coverage
    FROM   "Article" a
    JOIN   "Collection" c ON a."collectionId" = c.id
    CROSS  JOIN q
    WHERE  a."workspaceId" = ${workspaceId}
      AND  a.status = 'PUBLISHED'
      AND  c."visibility"::text = ANY(${allowedVisibility})
      AND  c."isArchived" = false
      AND  to_tsvector('english', a.title || ' ' || a.content)
             @@ plainto_tsquery('english', ${query})
    ORDER  BY ts_rank_cd(
                to_tsvector('english', a.title || ' ' || a.content),
                plainto_tsquery('english', ${query})
              ) DESC
    LIMIT  5
  `

  if (rows.length === 0) {
    return { articles: [], signal: NO_RETRIEVAL }
  }

  const coverage = Math.max(...rows.map((r) => (typeof r.coverage === 'number' ? r.coverage : 0)))
  const articles: ArticleRow[] = rows.map(({ coverage: _coverage, ...article }) => article)
  return { articles, signal: { mode: 'lexical', topScore: null, coverage } }
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

function buildSystemPrompt(ctx: AgentContext): string {
  let prompt = `You are a helpful AI customer support agent for ${ctx.workspaceName}.
Your job is to help customers by finding answers in the help center knowledge base.

INSTRUCTIONS:
1. When a customer asks a question, ALWAYS use the search_articles tool before answering it.
   You have no knowledge of ${ctx.workspaceName} beyond what search_articles returns.
2. After searching, use report_confidence to indicate how confident you are in your answer.
   Report honestly and low when the articles are a poor match. Your score can only LOWER
   the confidence that retrieval already measured — it can never raise it — so overstating
   it gains you nothing, while understating a genuinely weak answer correctly hands the
   customer to a human.
3. If your confidence is low (below threshold) or the customer requests a human, use escalate_to_human.
4. Answer ONLY using information from the help articles. Do not make up information.
5. Be concise, friendly, and professional.
6. If the articles don't fully answer the question, say what you do know and offer to escalate.
7. Reference specific articles when possible so the customer can read more.
8. Format responses in plain text. Keep them focused and easy to scan.
9. For greetings and small talk there is nothing to look up — just reply warmly and do not search.`

  if (ctx.aiInstructions?.trim()) {
    prompt += `\n\nADDITIONAL INSTRUCTIONS FROM THE SUPPORT TEAM:\n${ctx.aiInstructions.trim()}`
  }

  return prompt
}

// ---------------------------------------------------------------------------
// Article source tracking
// ---------------------------------------------------------------------------

/**
 * Persists an association between a conversation and the articles retrieved
 * during the agent's search phase. Used downstream for analytics and to
 * surface suggested reading to the customer.
 *
 * The upsert is intentionally fire-and-forget — a failure here must never
 * block the response stream. Errors are silently swallowed; the conversation
 * continues normally.
 */
async function trackConversationArticles(
  conversationId: string,
  articles: ArticleRow[]
): Promise<void> {
  for (const article of articles) {
    await prisma.conversationArticle
      .upsert({
        where: {
          conversationId_articleId: {
            conversationId,
            articleId: article.id,
          },
        },
        create: { conversationId, articleId: article.id },
        update: {},
      })
      .catch(() => {
        // Ignore — conversation row may not exist yet if the conversation is
        // being created concurrently, or the model may not have migrated yet.
      })
  }
}

// ---------------------------------------------------------------------------
// Main agent — streaming generator
// ---------------------------------------------------------------------------

/**
 * Runs the AI agent for a single conversational turn.
 *
 * Yields:
 *   - `{ type: 'text', text: string }` — text deltas to forward to the SSE stream.
 *   - `{ type: 'error', message: string }` — provider error; generation stops.
 *   - `{ type: 'done', sources, confidence, shouldEscalate, escalationReason }`
 *     — always the final event; carries all metadata the caller needs.
 *
 * The loop runs at most MAX_TOOL_ROUNDS rounds of tool use. In practice the
 * agent should complete in 2 rounds (search + respond) with a third only if it
 * decides to escalate mid-response. The hard cap prevents a runaway loop from
 * consuming tokens indefinitely.
 */
const MAX_TOOL_ROUNDS = 3

export async function* runAgent(
  ctx: AgentContext,
  conversationMessages: ChatMessage[]
): AsyncGenerator<AgentStreamEvent> {
  const provider = resolveProvider({
    aiProvider: ctx.aiProvider,
    aiApiKey: ctx.aiApiKey,
    aiModel: ctx.aiModel,
  })

  const system = buildSystemPrompt(ctx)

  // Build a mutable copy; we append assistant turns and tool results as we loop.
  const messages: ChatMessage[] = [...conversationMessages]

  const groundingEnabled = ctx.aiGroundingEnabled ?? true
  const floors: GroundingFloors = {
    retrievalFloor: ctx.aiRetrievalFloor ?? DEFAULT_RETRIEVAL_FLOOR,
    lexicalFloor: ctx.aiLexicalFloor ?? DEFAULT_LEXICAL_FLOOR,
  }

  // Accumulated metadata across all tool rounds.
  //
  // `searched` is the gate's precondition: an agent that never looked anything up
  // was never asked a knowledge-base question, so there is nothing to ground and
  // nothing to escalate. Note we track it separately from `bestSignal` — "searched
  // and found nothing" (grounding 0) and "never searched" (no opinion) are
  // different states with opposite outcomes.
  let searched = false
  let bestSignal: RetrievalSignal | null = null
  let bestSignalConfidence = -1
  let reported: number | null = null
  let lastReasoning = ''
  let shouldEscalate = false
  let escalationReason: string | undefined
  const allSources: ArticleSource[] = []

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const textParts: string[] = []
    const toolCalls: Array<{ name: string; args: Record<string, unknown> }> = []

    for await (const event of provider.streamChat({
      system,
      messages,
      tools: AGENT_TOOLS,
      maxTokens: 1024,
      model: ctx.aiModel ?? undefined,
    })) {
      switch (event.type) {
        case 'text':
          textParts.push(event.text)
          yield event
          break

        case 'tool_call':
          // Tool call events are buffered; we process them after the stream
          // for this round finishes so we can append a single assistant turn.
          toolCalls.push({ name: event.name, args: event.args })
          break

        case 'error':
          // Propagate provider errors immediately — no point continuing.
          yield event
          return

        case 'done':
          // Provider signals end of this stream; we handle it after the loop.
          break
      }
    }

    // No tool calls in this round — the agent has finished generating its
    // customer-facing reply. Break out of the tool-use loop.
    if (toolCalls.length === 0) {
      break
    }

    // --- Process tool calls ---
    const toolResults: string[] = []

    for (const tc of toolCalls) {
      if (tc.name === 'search_articles') {
        const rawQuery = tc.args['query']
        const query = typeof rawQuery === 'string' ? rawQuery.trim() : ''

        const { articles, signal } = await searchArticles(
          query,
          ctx.workspaceId,
          ctx.includeInternal
        )
        searched = true

        // Keep the BEST retrieval across every search this turn, not the last.
        // The agent may refine its query or chase a tangent; a weak follow-up
        // search must not retroactively discredit a well-grounded first hit that
        // the answer is actually built on.
        const signalConfidence = retrievalConfidence(signal, floors)
        if (signalConfidence > bestSignalConfidence) {
          bestSignalConfidence = signalConfidence
          bestSignal = signal
        }

        // Accumulate unique sources for the final done payload.
        for (const article of articles) {
          if (!allSources.some((s) => s.id === article.id)) {
            allSources.push({
              id: article.id,
              title: article.title,
              slug: article.slug,
              collection: article.collection,
            })
          }
        }

        // Persist conversation↔article associations for analytics.
        // Non-blocking — do not await in the hot path.
        void trackConversationArticles(ctx.conversationId, articles)

        if (articles.length === 0) {
          toolResults.push(`[search_articles result]: No articles found for "${query}".`)
        } else {
          const articleContext = articles
            .map((a, i) => {
              // Truncate content to keep the context window manageable.
              // The first 1500 characters reliably contain the key information
              // for most help articles while staying well within token limits.
              const content = a.content.slice(0, 1500)
              return `[Article ${i + 1}]: ${a.title}\n${content}`
            })
            .join('\n\n---\n\n')
          toolResults.push(
            `[search_articles result]: Found ${articles.length} article(s):\n\n${articleContext}`
          )
        }
      } else if (tc.name === 'report_confidence') {
        const rawReasoning = tc.args['reasoning']
        // null — not 0.5 — when the model reports nothing usable. A garbage score
        // is the absence of a signal, and must not be laundered into a passing one.
        reported = parseReportedConfidence(tc.args['score'])
        const reasoning = typeof rawReasoning === 'string' ? rawReasoning : ''
        lastReasoning = reasoning

        // Tell the model where it actually stands, so a weakly-grounded answer is
        // written honestly (or escalated by the model itself) rather than bluffed.
        // The escalation DECISION is not made here — it is made once, after the
        // loop, when the full retrieval picture for the turn is known.
        const soFar = effectiveConfidence({
          searched,
          groundingEnabled,
          signal: bestSignal,
          reported,
          ...floors,
        })
        const rejected = reported === null && tc.args['score'] !== undefined
        toolResults.push(
          `[report_confidence result]: ${
            rejected ? 'Score was not a number and has been ignored. ' : ''
          }Effective confidence is ${
            soFar === null ? 'not applicable (no search was performed)' : soFar.toFixed(2)
          }, which is the lower of your own score and how well the knowledge base matched. ${reasoning}`
        )
      } else if (tc.name === 'escalate_to_human') {
        shouldEscalate = true
        const rawReason = tc.args['reason']
        escalationReason =
          typeof rawReason === 'string' ? rawReason.slice(0, 500) : 'Agent requested escalation'

        toolResults.push(
          `[escalate_to_human result]: Escalation initiated. Reason: ${escalationReason}`
        )
      } else {
        // Unknown tool — surface as an error result so the model can recover.
        toolResults.push(`[${tc.name} result]: Unknown tool — ignored.`)
      }
    }

    // Append the assistant turn (text + implicit tool calls) and tool results
    // as the next user turn so the model has full context in the next round.
    //
    // We use the text content when present; if the assistant only made tool
    // calls with no prose, we synthesise a placeholder so the message is not
    // blank (some providers reject empty content strings).
    const assistantContent =
      textParts.join('') || `[Used tools: ${toolCalls.map((t) => t.name).join(', ')}]`
    messages.push({ role: 'assistant', content: assistantContent })
    messages.push({ role: 'user', content: toolResults.join('\n\n') })
  }

  // --- The escalation gate ---
  //
  // Decided exactly once, here, with the whole turn in view. Deciding inside the
  // report_confidence handler (as this used to) meant judging on a partial
  // picture: the model could report a score before its last search had run.
  const confidence = effectiveConfidence({
    searched,
    groundingEnabled,
    signal: bestSignal,
    reported,
    ...floors,
  })

  // An explicit escalate_to_human call always wins — the customer asking for a
  // person is not a confidence question.
  if (!shouldEscalate && shouldEscalateOn(confidence, ctx.aiEscalationThreshold)) {
    shouldEscalate = true
    const detail = lastReasoning ? `: ${lastReasoning}` : ''
    escalationReason = `Answer not grounded in the knowledge base (confidence ${(
      confidence ?? 0
    ).toFixed(2)}, ${describeSignal(bestSignal)})${detail}`.slice(0, 500)
  }

  // Yield the terminal event with all accumulated metadata. The grounding
  // breakdown rides along so callers can persist it — a single scalar cannot
  // tell you afterwards WHY a turn escalated, and without that you cannot
  // measure over-abstention (escalating while a good article existed) against
  // wrong answers (grounded, but to the wrong article).
  yield {
    type: 'done',
    sources: allSources,
    confidence,
    reportedConfidence: reported,
    retrievalMode: bestSignal?.mode ?? 'none',
    retrievalScore: bestSignal ? (bestSignal.topScore ?? bestSignal.coverage) : null,
    shouldEscalate,
    escalationReason,
  }
}

/** Human-readable provenance for an escalation reason, e.g. "vector match 0.08". */
function describeSignal(signal: RetrievalSignal | null): string {
  if (!signal || signal.mode === 'none') return 'no articles matched'
  if (signal.mode === 'vector') return `best vector match ${(signal.topScore ?? 0).toFixed(2)}`
  return `best keyword coverage ${(signal.coverage ?? 0).toFixed(2)}`
}

// ---------------------------------------------------------------------------
// Knowledge gap tracking
// ---------------------------------------------------------------------------

/**
 * Records or increments a knowledge gap entry when the agent cannot answer
 * a customer question well. Called by the conversation API route after the
 * agent stream completes with low confidence or an escalation.
 *
 * Matching is EXACT, not semantic. The query is lowercased, trimmed, its runs of
 * whitespace collapsed, truncated to 500 chars and SHA-256'd; only queries that
 * normalise to the identical string share a row. "how do I reset my password" and
 * "How do I reset my password?" do not collide — the trailing question mark
 * survives normalisation — and paraphrases never collide. Occurrence counts are
 * therefore a floor on how often a gap was hit, not an exact tally, and the
 * auto-draft threshold (autoDraftGapThreshold) fires later than it appears to.
 *
 * Clustering paraphrases would need the same embedding pipeline the agent uses;
 * that is a deliberate non-goal here.
 *
 * This is intentionally a standalone function rather than embedded in runAgent
 * so callers can choose when (and whether) to record gaps — e.g. only when
 * confidence is below a threshold AND no human is available.
 */
export async function recordKnowledgeGap(
  workspaceId: string,
  query: string
): Promise<{
  id: string
  query: string
  occurrences: number
  resolvedArticleId: string | null
} | null> {
  const normalized = query.toLowerCase().trim().replace(/\s+/g, ' ').slice(0, 500)
  const queryHash = crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 16)

  return await prisma.knowledgeGap.upsert({
    where: { workspaceId_queryHash: { workspaceId, queryHash } },
    create: {
      workspaceId,
      query: normalized,
      queryHash,
      occurrences: 1,
      lastSeenAt: new Date(),
    },
    update: {
      occurrences: { increment: 1 },
      lastSeenAt: new Date(),
    },
    select: {
      id: true,
      query: true,
      occurrences: true,
      resolvedArticleId: true,
    },
  })
}
