import { HttpClient } from './http'
import { ArticlesResource } from './resources/articles'
import { CollectionsResource } from './resources/collections'
import type { HelpNestConfig } from './types'

export { HelpNestError } from './http'
export type {
  Article,
  ArticleStatus,
  ArticleVersion,
  Collection,
  CreateArticleParams,
  CreateCollectionParams,
  HelpNestConfig,
  ListArticlesParams,
  ListCollectionsParams,
  MemberRole,
  PaginatedResponse,
  SearchResult,
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

  constructor(config: HelpNestConfig) {
    const http = new HttpClient(config)
    this.articles = new ArticlesResource(http)
    this.collections = new CollectionsResource(http)
  }
}
