import { HttpClient } from './http'
import { ArticlesResource } from './resources/articles'
import { CollectionsResource } from './resources/collections'
import { ConversationsResource, MessagesResource } from './resources/conversations'
import { KnowledgeGapsResource } from './resources/knowledge-gaps'
import type { HealthResponse, HelpNestConfig } from './types'

export { HelpNestError } from './http'
export type {
  Article,
  ArticleStatus,
  ArticleVersion,
  BatchArticleAction,
  BatchArticleParams,
  BatchArticleResponse,
  ChangeFeedEntry,
  ChangeFeedResponse,
  Collection,
  CollectionVisibility,
  Conversation,
  ConversationMessage,
  ConversationStatus,
  CreateArticleParams,
  CreateCollectionParams,
  CreateConversationParams,
  ExportArticle,
  ExportCollection,
  ExportResponse,
  HealthResponse,
  HelpNestConfig,
  KnowledgeGap,
  ListArticlesParams,
  ListCollectionsParams,
  ListConversationsParams,
  ListKnowledgeGapsParams,
  MemberRole,
  MessageRole,
  PaginatedResponse,
  ResolveKnowledgeGapParams,
  SearchResult,
  SendMessageParams,
  UpdateArticleParams,
  UpdateCollectionParams,
  Workspace,
} from './types'

/**
 * HelpNest JavaScript/TypeScript SDK
 *
 * @example
 * ```typescript
 * import { HelpNest } from '@helpnest/sdk'
 *
 * const client = new HelpNest({
 *   apiKey: 'hn_live_xxx',
 *   workspace: 'acme',
 *   baseUrl: 'https://help.acme.com',
 * })
 *
 * const articles = await client.articles.list({ status: 'PUBLISHED' })
 * const article = await client.articles.get('getting-started')
 * await client.articles.update(article.id, { status: 'ARCHIVED' })
 * ```
 */
export class HelpNest {
  /** Article management and search */
  readonly articles: ArticlesResource
  /** Collection management */
  readonly collections: CollectionsResource
  /** Conversation management */
  readonly conversations: ConversationsResource
  /** Conversation message management */
  readonly messages: MessagesResource
  /** Knowledge gap tracking */
  readonly knowledgeGaps: KnowledgeGapsResource

  private http: HttpClient

  constructor(config: HelpNestConfig) {
    this.http = new HttpClient(config)
    this.articles = new ArticlesResource(this.http)
    this.collections = new CollectionsResource(this.http)
    this.conversations = new ConversationsResource(this.http)
    this.messages = new MessagesResource(this.http)
    this.knowledgeGaps = new KnowledgeGapsResource(this.http)
  }

  /**
   * Check API and service health.
   */
  async health(): Promise<HealthResponse> {
    return this.http.get<HealthResponse>('/health')
  }
}
