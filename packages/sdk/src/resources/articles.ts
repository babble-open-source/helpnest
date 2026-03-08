import type { HttpClient } from '../http'
import type {
  Article,
  ArticleVersion,
  CreateArticleParams,
  ListArticlesParams,
  SearchResult,
  UpdateArticleParams,
} from '../types'

export class ArticlesResource {
  constructor(private http: HttpClient) {}

  /**
   * List articles in the workspace.
   * Optionally filter by collection, status, or paginate.
   */
  async list(params?: ListArticlesParams): Promise<Article[]> {
    return this.http.get<Article[]>('/articles', params as Record<string, string | number | boolean | undefined>)
  }

  /**
   * Get a single article by its ID or slug.
   */
  async get(idOrSlug: string): Promise<Article> {
    return this.http.get<Article>(`/articles/${idOrSlug}`)
  }

  /**
   * Create a new article. Returns the created article.
   */
  async create(params: CreateArticleParams): Promise<Article> {
    return this.http.post<Article>('/articles', params)
  }

  /**
   * Update an article by ID. Only provided fields are updated.
   */
  async update(id: string, params: UpdateArticleParams): Promise<Article> {
    return this.http.patch<Article>(`/articles/${id}`, params)
  }

  /**
   * Delete an article by ID.
   */
  async delete(id: string): Promise<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`/articles/${id}`)
  }

  /**
   * Search articles using full-text search.
   */
  async search(query: string): Promise<SearchResult[]> {
    const res = await this.http.get<{ results: SearchResult[] }>('/search', { q: query })
    return res.results
  }

  /**
   * List version history for an article.
   */
  async listVersions(articleId: string): Promise<ArticleVersion[]> {
    return this.http.get<ArticleVersion[]>(`/articles/${articleId}/versions`)
  }

  /**
   * Save a new version snapshot for an article.
   */
  async createVersion(articleId: string, params: { title: string; content: string }): Promise<ArticleVersion> {
    return this.http.post<ArticleVersion>(`/articles/${articleId}/versions`, params)
  }
}
