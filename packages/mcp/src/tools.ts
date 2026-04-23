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
    {
      name: 'create_collection',
      description:
        'Create a new collection (category) in the knowledge base. Returns the created ' +
        'collection ID which can be used as collectionId when creating articles.',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Collection title (e.g. "Getting Started")' },
          description: { type: 'string', description: 'Short description of the collection' },
          emoji: { type: 'string', description: 'Emoji icon for the collection (e.g. "🚀")' },
          slug: { type: 'string', description: 'URL slug (auto-generated from title if omitted)' },
        },
        required: ['title'],
      },
    },
    {
      name: 'create_article',
      description:
        'Create a new help article in the knowledge base. Content should be Markdown. ' +
        'Returns the created article ID and slug.',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Article title' },
          content: { type: 'string', description: 'Article body in Markdown' },
          collection_id: { type: 'string', description: 'ID of the collection to put this article in' },
          excerpt: { type: 'string', description: 'Short summary shown in search results' },
          slug: { type: 'string', description: 'URL slug (auto-generated from title if omitted)' },
          status: { type: 'string', enum: ['DRAFT', 'PUBLISHED'], description: 'Publish status (default: PUBLISHED)' },
        },
        required: ['title', 'content', 'collection_id'],
      },
    },
    {
      name: 'update_article',
      description: 'Update an existing article by its ID or slug.',
      inputSchema: {
        type: 'object',
        properties: {
          slug_or_id: { type: 'string', description: 'Article slug or ID to update' },
          title: { type: 'string', description: 'New title' },
          content: { type: 'string', description: 'New body in Markdown' },
          excerpt: { type: 'string', description: 'New excerpt' },
          status: { type: 'string', enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'], description: 'New status' },
        },
        required: ['slug_or_id'],
      },
    },
    {
      name: 'delete_article',
      description: 'Permanently delete an article by its ID or slug.',
      inputSchema: {
        type: 'object',
        properties: {
          slug_or_id: { type: 'string', description: 'Article slug or ID to delete' },
        },
        required: ['slug_or_id'],
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
      case 'create_collection':
        return await createCollection(client, args)
      case 'create_article':
        return await createArticle(client, args)
      case 'update_article':
        return await updateArticle(client, args)
      case 'delete_article':
        return await deleteArticle(client, args)
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

async function createCollection(client: HelpNest, args: Record<string, unknown>): Promise<ToolResult> {
  const title = args.title
  if (typeof title !== 'string' || title.trim() === '') {
    return errorResult('title must be a non-empty string')
  }

  const collection = await client.collections.create({
    title: title.trim(),
    ...(typeof args.description === 'string' ? { description: args.description } : {}),
    ...(typeof args.emoji === 'string' ? { emoji: args.emoji } : {}),
    ...(typeof args.slug === 'string' ? { slug: args.slug } : {}),
    visibility: 'PUBLIC',
  })

  return textResult(
    `Collection created.\n\n**Title:** ${collection.title}\n**ID:** ${collection.id}\n**Slug:** ${collection.slug}`,
  )
}

async function createArticle(client: HelpNest, args: Record<string, unknown>): Promise<ToolResult> {
  const title = args.title
  const content = args.content
  const collectionId = args.collection_id

  if (typeof title !== 'string' || title.trim() === '') return errorResult('title must be a non-empty string')
  if (typeof content !== 'string' || content.trim() === '') return errorResult('content must be a non-empty string')
  if (typeof collectionId !== 'string' || collectionId.trim() === '') return errorResult('collection_id must be a non-empty string')

  const article = await client.articles.create({
    title: title.trim(),
    content: content.trim(),
    collectionId: collectionId.trim(),
    status: args.status === 'DRAFT' ? 'DRAFT' : 'PUBLISHED',
    ...(typeof args.excerpt === 'string' ? { excerpt: args.excerpt } : {}),
    ...(typeof args.slug === 'string' ? { slug: args.slug } : {}),
  })

  return textResult(
    `Article created.\n\n**Title:** ${article.title}\n**ID:** ${article.id}\n**Slug:** ${article.slug}\n**Status:** ${article.status}`,
  )
}

async function updateArticle(client: HelpNest, args: Record<string, unknown>): Promise<ToolResult> {
  const slugOrId = args.slug_or_id
  if (typeof slugOrId !== 'string' || slugOrId.trim() === '') return errorResult('slug_or_id must be a non-empty string')

  const article = await client.articles.get(slugOrId.trim())

  const updated = await client.articles.update(article.id, {
    ...(typeof args.title === 'string' ? { title: args.title } : {}),
    ...(typeof args.content === 'string' ? { content: args.content } : {}),
    ...(typeof args.excerpt === 'string' ? { excerpt: args.excerpt } : {}),
    ...(args.status === 'DRAFT' || args.status === 'PUBLISHED' || args.status === 'ARCHIVED'
      ? { status: args.status }
      : {}),
  })

  return textResult(`Article updated.\n\n**Title:** ${updated.title}\n**ID:** ${updated.id}\n**Status:** ${updated.status}`)
}

async function deleteArticle(client: HelpNest, args: Record<string, unknown>): Promise<ToolResult> {
  const slugOrId = args.slug_or_id
  if (typeof slugOrId !== 'string' || slugOrId.trim() === '') return errorResult('slug_or_id must be a non-empty string')

  const article = await client.articles.get(slugOrId.trim())
  await client.articles.delete(article.id)

  return textResult(`Article "${article.title}" (${article.id}) deleted.`)
}

// ── Result helpers ────────────────────────────────────────────────────────────

function textResult(text: string): ToolResult {
  return { content: [{ type: 'text', text }] }
}

function errorResult(message: string): ToolResult {
  return { content: [{ type: 'text', text: `Error: ${message}` }], isError: true }
}
