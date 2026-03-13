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
import crypto from 'crypto';
import { resolveProvider } from '@/lib/ai/resolve-provider';
import { prisma } from '@/lib/db';
import { embedText } from '@/lib/embeddings';
import { qdrant, COLLECTION_NAME, ensureCollection } from '@/lib/qdrant';
// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------
const AGENT_TOOLS = [
    {
        name: 'search_articles',
        description: 'Search the help center knowledge base for articles relevant to the customer question. ' +
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
        description: 'Report your confidence level in the answer you are about to give. ' +
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
        description: 'Escalate this conversation to a human support agent. ' +
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
];
// ---------------------------------------------------------------------------
// Article search — wraps the existing RAG pipeline
// ---------------------------------------------------------------------------
/**
 * Retrieves up to 5 published articles matching `query` for the given workspace.
 *
 * Strategy:
 *   1. Attempt OpenAI embedding + Qdrant vector search (preserves semantic ranking).
 *   2. Fall back to PostgreSQL full-text search if embeddings or Qdrant are unavailable.
 *
 * Both paths filter to published articles in public, non-archived collections so the
 * agent can never surface draft or restricted content to customers.
 */
async function searchArticles(query, workspaceId) {
    // --- Vector path ---
    let queryEmbedding = [];
    try {
        queryEmbedding = await embedText(query);
    }
    catch {
        // OPENAI_API_KEY not configured or network error — proceed to full-text.
    }
    if (queryEmbedding.length > 0) {
        try {
            await ensureCollection();
            const results = await qdrant.search(COLLECTION_NAME, {
                vector: queryEmbedding,
                limit: 5,
                filter: { must: [{ key: 'workspaceId', match: { value: workspaceId } }] },
                with_payload: true,
            });
            // Deduplicate: a single article may have multiple chunk points in Qdrant.
            // We preserve the order of first appearance (highest similarity first).
            const seenIds = new Set();
            const articleIds = [];
            for (const result of results) {
                const articleId = result.payload?.['articleId'];
                if (typeof articleId === 'string' && !seenIds.has(articleId)) {
                    seenIds.add(articleId);
                    articleIds.push(articleId);
                }
            }
            if (articleIds.length > 0) {
                const rows = await prisma.article.findMany({
                    where: {
                        id: { in: articleIds },
                        workspaceId,
                        status: 'PUBLISHED',
                        collection: { is: { isPublic: true, isArchived: false } },
                    },
                    select: {
                        id: true,
                        title: true,
                        slug: true,
                        content: true,
                        collection: { select: { slug: true, title: true } },
                    },
                });
                // Re-order to match vector similarity ranking (Prisma findMany doesn't
                // guarantee ORDER BY ... IN list ordering).
                const byId = new Map(rows.map((r) => [r.id, r]));
                return articleIds.map((id) => byId.get(id)).filter((r) => r !== undefined);
            }
        }
        catch {
            // Qdrant unavailable — fall through to full-text.
        }
    }
    // --- Full-text fallback ---
    return prisma.$queryRaw `
    SELECT a.id, a.title, a.slug, a.content,
           json_build_object('slug', c.slug, 'title', c.title) AS collection
    FROM   "Article" a
    JOIN   "Collection" c ON a."collectionId" = c.id
    WHERE  a."workspaceId" = ${workspaceId}
      AND  a.status = 'PUBLISHED'
      AND  c."isPublic" = true
      AND  c."isArchived" = false
      AND  to_tsvector('english', a.title || ' ' || a.content)
             @@ plainto_tsquery('english', ${query})
    ORDER  BY ts_rank_cd(
                to_tsvector('english', a.title || ' ' || a.content),
                plainto_tsquery('english', ${query})
              ) DESC
    LIMIT  5
  `;
}
// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------
function buildSystemPrompt(ctx) {
    let prompt = `You are a helpful AI customer support agent for ${ctx.workspaceName}.
Your job is to help customers by finding answers in the help center knowledge base.

INSTRUCTIONS:
1. When a customer asks a question, use the search_articles tool to find relevant articles.
2. After searching, use report_confidence to indicate how confident you are in your answer.
3. If your confidence is low (below threshold) or the customer requests a human, use escalate_to_human.
4. Answer ONLY using information from the help articles. Do not make up information.
5. Be concise, friendly, and professional.
6. If the articles don't fully answer the question, say what you do know and offer to escalate.
7. Reference specific articles when possible so the customer can read more.
8. Format responses in plain text. Keep them focused and easy to scan.`;
    if (ctx.aiInstructions?.trim()) {
        prompt += `\n\nADDITIONAL INSTRUCTIONS FROM THE SUPPORT TEAM:\n${ctx.aiInstructions.trim()}`;
    }
    return prompt;
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
async function trackConversationArticles(conversationId, articles) {
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
        });
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
const MAX_TOOL_ROUNDS = 3;
export async function* runAgent(ctx, conversationMessages) {
    const provider = resolveProvider({
        aiProvider: ctx.aiProvider,
        aiApiKey: ctx.aiApiKey,
        aiModel: ctx.aiModel,
    });
    const system = buildSystemPrompt(ctx);
    // Build a mutable copy; we append assistant turns and tool results as we loop.
    const messages = [...conversationMessages];
    // Accumulated metadata across all tool rounds.
    let confidence = 0.5;
    let shouldEscalate = false;
    let escalationReason;
    const allSources = [];
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const textParts = [];
        const toolCalls = [];
        for await (const event of provider.streamChat({
            system,
            messages,
            tools: AGENT_TOOLS,
            maxTokens: 1024,
        })) {
            switch (event.type) {
                case 'text':
                    textParts.push(event.text);
                    yield event;
                    break;
                case 'tool_call':
                    // Tool call events are buffered; we process them after the stream
                    // for this round finishes so we can append a single assistant turn.
                    toolCalls.push({ name: event.name, args: event.args });
                    break;
                case 'error':
                    // Propagate provider errors immediately — no point continuing.
                    yield event;
                    return;
                case 'done':
                    // Provider signals end of this stream; we handle it after the loop.
                    break;
            }
        }
        // No tool calls in this round — the agent has finished generating its
        // customer-facing reply. Break out of the tool-use loop.
        if (toolCalls.length === 0) {
            break;
        }
        // --- Process tool calls ---
        const toolResults = [];
        for (const tc of toolCalls) {
            if (tc.name === 'search_articles') {
                const rawQuery = tc.args['query'];
                const query = typeof rawQuery === 'string' ? rawQuery.trim() : '';
                const articles = await searchArticles(query, ctx.workspaceId);
                // Accumulate unique sources for the final done payload.
                for (const article of articles) {
                    if (!allSources.some((s) => s.id === article.id)) {
                        allSources.push({
                            id: article.id,
                            title: article.title,
                            slug: article.slug,
                            collection: article.collection,
                        });
                    }
                }
                // Persist conversation↔article associations for analytics.
                // Non-blocking — do not await in the hot path.
                void trackConversationArticles(ctx.conversationId, articles);
                if (articles.length === 0) {
                    toolResults.push(`[search_articles result]: No articles found for "${query}".`);
                }
                else {
                    const articleContext = articles
                        .map((a, i) => {
                        // Truncate content to keep the context window manageable.
                        // The first 1500 characters reliably contain the key information
                        // for most help articles while staying well within token limits.
                        const content = a.content.slice(0, 1500);
                        return `[Article ${i + 1}]: ${a.title}\n${content}`;
                    })
                        .join('\n\n---\n\n');
                    toolResults.push(`[search_articles result]: Found ${articles.length} article(s):\n\n${articleContext}`);
                }
            }
            else if (tc.name === 'report_confidence') {
                const rawScore = tc.args['score'];
                const rawReasoning = tc.args['reasoning'];
                // Clamp to [0, 1] — we never trust numeric values from the model directly.
                confidence = typeof rawScore === 'number' ? Math.max(0, Math.min(1, rawScore)) : 0.5;
                const reasoning = typeof rawReasoning === 'string' ? rawReasoning : '';
                toolResults.push(`[report_confidence result]: Confidence recorded at ${confidence.toFixed(2)}. ${reasoning}`);
                // Auto-escalate when confidence falls below the workspace threshold.
                if (confidence < ctx.aiEscalationThreshold) {
                    shouldEscalate = true;
                    escalationReason =
                        `Low AI confidence (${confidence.toFixed(2)}): ${reasoning}`.slice(0, 500);
                }
            }
            else if (tc.name === 'escalate_to_human') {
                shouldEscalate = true;
                const rawReason = tc.args['reason'];
                escalationReason =
                    typeof rawReason === 'string' ? rawReason.slice(0, 500) : 'Agent requested escalation';
                toolResults.push(`[escalate_to_human result]: Escalation initiated. Reason: ${escalationReason}`);
            }
            else {
                // Unknown tool — surface as an error result so the model can recover.
                toolResults.push(`[${tc.name} result]: Unknown tool — ignored.`);
            }
        }
        // Append the assistant turn (text + implicit tool calls) and tool results
        // as the next user turn so the model has full context in the next round.
        //
        // We use the text content when present; if the assistant only made tool
        // calls with no prose, we synthesise a placeholder so the message is not
        // blank (some providers reject empty content strings).
        const assistantContent = textParts.join('') || `[Used tools: ${toolCalls.map((t) => t.name).join(', ')}]`;
        messages.push({ role: 'assistant', content: assistantContent });
        messages.push({ role: 'user', content: toolResults.join('\n\n') });
    }
    // Yield the terminal event with all accumulated metadata.
    yield {
        type: 'done',
        sources: allSources,
        confidence,
        shouldEscalate,
        escalationReason,
    };
}
// ---------------------------------------------------------------------------
// Knowledge gap tracking
// ---------------------------------------------------------------------------
/**
 * Records or increments a knowledge gap entry when the agent cannot answer
 * a customer question well. Called by the conversation API route after the
 * agent stream completes with low confidence or an escalation.
 *
 * Queries are normalised and hashed so that semantically identical questions
 * accumulate counts on a single row rather than creating duplicates.
 *
 * This is intentionally a standalone function rather than embedded in runAgent
 * so callers can choose when (and whether) to record gaps — e.g. only when
 * confidence is below a threshold AND no human is available.
 */
export async function recordKnowledgeGap(workspaceId, query) {
    const normalized = query.toLowerCase().trim().replace(/\s+/g, ' ').slice(0, 500);
    const queryHash = crypto
        .createHash('sha256')
        .update(normalized)
        .digest('hex')
        .slice(0, 16);
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
    });
}
