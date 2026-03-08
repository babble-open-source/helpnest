export interface SearchResult {
  id: string
  title: string
  slug: string
  snippet: string
  collection: { title: string; slug: string }
  readTime: number
}

export async function searchArticles(
  query: string,
  workspace: string,
  baseUrl: string
): Promise<SearchResult[]> {
  if (query.length < 2) return []
  try {
    const url = `${baseUrl}/api/search?q=${encodeURIComponent(query)}&workspace=${workspace}`
    const res = await fetch(url)
    if (!res.ok) return []
    const data = await res.json() as { results: SearchResult[] }
    return data.results ?? []
  } catch {
    return []
  }
}
