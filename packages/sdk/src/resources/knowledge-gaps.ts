import type { HttpClient } from '../http'
import type {
  KnowledgeGap,
  ListKnowledgeGapsParams,
  PaginatedResponse,
  ResolveKnowledgeGapParams,
} from '../types'

export class KnowledgeGapsResource {
  constructor(private http: HttpClient) {}

  /**
   * List knowledge gaps (unanswered queries).
   * Filter by resolved status and paginate.
   */
  async list(params?: ListKnowledgeGapsParams): Promise<PaginatedResponse<KnowledgeGap>> {
    return this.http.get('/knowledge-gaps', params as Record<string, string | number | boolean | undefined>)
  }

  /**
   * Resolve a knowledge gap, optionally linking it to an article.
   */
  async resolve(params: ResolveKnowledgeGapParams): Promise<KnowledgeGap> {
    return this.http.patch('/knowledge-gaps', params)
  }
}
