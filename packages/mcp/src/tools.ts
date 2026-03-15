import type { HelpNest } from '@helpnest/sdk'

// ── Types ────────────────────────────────────────────────────────────────────

interface ToolDefinition {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
}

type ToolResult = {
  content: Array<{ type: 'text'; text: string }>
  isError?: boolean
}

// ── Tool registry ─────────────────────────────────────────────────────────────

export function getToolDefinitions(): ToolDefinition[] {
  return [
    {
      name: 'search_articles',
      description:
        'Search help center articles by keyword query. Returns matching article titles, ' +
        'slugs, and text snippets. Use this to discover relevant content before fetching ' +
        'full article bodies.',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query string (e.g. "how to reset password")',
          },
        },
        required: ['query'],
      },
    },
    {
      name: 'get_article',
      description:
        'Get the full content of a specific help article by its slug or ID. Returns the ' +
        'article title, body content, status, view count, and last-updated timestamp.',
      inputSchema: {
        type: 'object',
        properties: {
          slug_or_id: {
            type: 'string',
            description: 'Article slug (e.g. "getting-started") or cuid ID',
          },
        },
        required: ['slug_or_id'],
      },
    },
    {
      name: 'list_collections',
      description:
        'List all collections (categories) in the knowledge base. Returns each ' +
        'collection\'s title, slug, and description. Use this to understand how the ' +
        'knowledge base is structured before searching.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'ask_question',
      description:
        'Answer a question using the knowledge base. Searches for relevant articles and ' +
        'returns their full content so you can synthesize an accurate answer. Fetches up ' +
        'to 3 top matching articles.',
      inputSchema: {
        type: 'object',
        properties: {
          question: {
            type: 'string',
            description: 'The question to answer (e.g. "How do I cancel my subscription?")',
          },
        },
        required: ['question'],
      },
    },
  ]
}

// ── Dispatch ──────────────────────────────────────────────────────────────────

export async function handleToolCall(
  client: HelpNest,
  toolName: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  try {
    switch (toolName) {
      case 'search_articles':
        return await searchArticles(client, args)
      case 'get_article':
        return await getArticle(client, args)
      case 'list_collections':
        return await listCollections(client)
      case 'ask_question':
        return await askQuestion(client, args)
      default:
        return errorResult(`Unknown tool: ${toolName}`)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error occurred'
    return errorResult(message)
  }
}

// ── Tool implementations ──────────────────────────────────────────────────────

async function searchArticles(client: HelpNest, args: Record<string, unknown>): Promise<ToolResult> {
  const query = args.query
  if (typeof query !== 'string' || query.trim() === '') {
    return errorResult('query must be a non-empty string')
  }

  const results = await client.articles.search(query.trim())

  if (results.length === 0) {
    return textResult(`No articles found matching "${query}".`)
  }

  const lines = results.map((r, i) => {
    const collectionLabel = r.collection?.title ? ` · ${r.collection.title}` : ''
    return `${i + 1}. **${r.title}** (slug: \`${r.slug}\`${collectionLabel})\n   ${r.snippet}`
  })

  return textResult(`Found ${results.length} article(s) for "${query}":\n\n${lines.join('\n\n')}`)
}

async function getArticle(client: HelpNest, args: Record<string, unknown>): Promise<ToolResult> {
  const slugOrId = args.slug_or_id
  if (typeof slugOrId !== 'string' || slugOrId.trim() === '') {
    return errorResult('slug_or_id must be a non-empty string')
  }

  const article = await client.articles.get(slugOrId.trim())

  const meta = [
    `**Status:** ${article.status}`,
    `**Views:** ${article.views}`,
    `**Updated:** ${article.updatedAt}`,
    article.publishedAt ? `**Published:** ${article.publishedAt}` : null,
    article.excerpt ? `**Excerpt:** ${article.excerpt}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  return textResult(`# ${article.title}\n\n${meta}\n\n---\n\n${article.content}`)
}

async function listCollections(client: HelpNest): Promise<ToolResult> {
  const result = await client.collections.list()
  const collections = result.data

  if (collections.length === 0) {
    return textResult('No collections found in this workspace.')
  }

  const lines = collections.map((c) => {
    const desc = c.description ? `: ${c.description}` : ''
    const archived = c.isArchived ? ' [archived]' : ''
    return `- **${c.title}** (slug: \`${c.slug}\`)${desc}${archived}`
  })

  return textResult(`${collections.length} collection(s):\n\n${lines.join('\n')}`)
}

async function askQuestion(client: HelpNest, args: Record<string, unknown>): Promise<ToolResult> {
  const question = args.question
  if (typeof question !== 'string' || question.trim() === '') {
    return errorResult('question must be a non-empty string')
  }

  const results = await client.articles.search(question.trim())

  if (results.length === 0) {
    return textResult(
      `No relevant articles found in the knowledge base for: "${question}". ` +
        'The knowledge base may not contain information on this topic.',
    )
  }

  // Fetch full content for the top 3 results in parallel.
  // Fall back to the search snippet if the full-article fetch fails — this keeps
  // the tool useful even if individual articles are temporarily unavailable.
  const topResults = results.slice(0, 3)
  const articles = await Promise.all(
    topResults.map(async (r) => {
      try {
        const full = await client.articles.get(r.slug)
        return { title: full.title, content: full.content }
      } catch {
        return { title: r.title, content: r.snippet }
      }
    }),
  )

  const sections = articles
    .map((a) => `## ${a.title}\n\n${a.content}`)
    .join('\n\n---\n\n')

  return textResult(
    `Here are the most relevant knowledge base articles for "${question}":\n\n${sections}`,
  )
}

// ── Result helpers ────────────────────────────────────────────────────────────

function textResult(text: string): ToolResult {
  return { content: [{ type: 'text', text }] }
}

function errorResult(message: string): ToolResult {
  return { content: [{ type: 'text', text: `Error: ${message}` }], isError: true }
}
