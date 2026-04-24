import type { WidgetConfig, CollectionNode, ArticleSummary, ArticleDetail, ConversationSummary } from './types'

let baseUrl = ''
let workspaceSlug = ''

export function initApi(base: string, slug: string) {
  baseUrl = base
  workspaceSlug = slug
}

export async function fetchConfig(): Promise<WidgetConfig> {
  const res = await fetch(`${baseUrl}/api/widget/config?workspace=${encodeURIComponent(workspaceSlug)}`)
  if (!res.ok) throw new Error(`Config fetch failed: ${res.status}`)
  return res.json() as Promise<WidgetConfig>
}

export async function fetchCollections(): Promise<CollectionNode[]> {
  const res = await fetch(`${baseUrl}/api/widget/collections?workspace=${encodeURIComponent(workspaceSlug)}`)
  if (!res.ok) return []
  const data = await res.json() as { collections: CollectionNode[] }
  return data.collections ?? []
}

export async function fetchArticles(collectionId: string): Promise<{ collection: { title: string; description: string | null; slug: string }; articles: ArticleSummary[] }> {
  const res = await fetch(`${baseUrl}/api/widget/articles?collection=${encodeURIComponent(collectionId)}`)
  if (!res.ok) return { collection: { title: '', description: null, slug: '' }, articles: [] }
  return res.json() as Promise<{ collection: { title: string; description: string | null; slug: string }; articles: ArticleSummary[] }>
}

export async function fetchArticle(articleId: string): Promise<ArticleDetail | null> {
  const res = await fetch(`${baseUrl}/api/widget/article/${encodeURIComponent(articleId)}`)
  if (!res.ok) return null
  return res.json() as Promise<ArticleDetail>
}

export async function searchArticles(query: string): Promise<ArticleSummary[]> {
  if (query.length < 2) return []
  const res = await fetch(`${baseUrl}/api/search?q=${encodeURIComponent(query)}&workspace=${encodeURIComponent(workspaceSlug)}`)
  if (!res.ok) return []
  const data = await res.json() as { results: ArticleSummary[] }
  return data.results ?? []
}

export async function fetchConversations(visitorId: string, sessionTokens: string[]): Promise<ConversationSummary[]> {
  if (!visitorId && sessionTokens.length === 0) return []
  const headers: Record<string, string> = {}
  if (visitorId) headers['X-Visitor-Id'] = visitorId
  if (sessionTokens.length > 0) headers['X-Session-Token'] = sessionTokens.join(',')
  const res = await fetch(`${baseUrl}/api/widget/conversations`, { headers })
  if (!res.ok) return []
  const data = await res.json() as { conversations: ConversationSummary[] }
  return data.conversations ?? []
}

export async function submitArticleFeedback(articleId: string, type: 'helpful' | 'not'): Promise<void> {
  const voterToken = getVoterToken()
  await fetch(`${baseUrl}/api/widget/article/${encodeURIComponent(articleId)}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, voterToken }),
  })
}

function getVoterToken(): string {
  const key = 'helpnest:voter'
  let token = localStorage.getItem(key)
  if (!token) {
    token = crypto.randomUUID()
    localStorage.setItem(key, token)
  }
  return token
}
