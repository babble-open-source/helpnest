import { HttpClient } from './http';
import { ArticlesResource } from './resources/articles';
import { CollectionsResource } from './resources/collections';
import { ConversationsResource, MessagesResource } from './resources/conversations';
export { HelpNestError } from './http';
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
    articles;
    /** Collection management */
    collections;
    /** Conversation management */
    conversations;
    /** Conversation message management */
    messages;
    constructor(config) {
        const http = new HttpClient(config);
        this.articles = new ArticlesResource(http);
        this.collections = new CollectionsResource(http);
        this.conversations = new ConversationsResource(http);
        this.messages = new MessagesResource(http);
    }
}
