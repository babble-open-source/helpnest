# @helpnest/sdk

Official TypeScript/JavaScript SDK for the HelpNest REST API. Supports CommonJS and ESM. Zero runtime dependencies.

## Installation

```
npm install @helpnest/sdk
```

## Initialization

```ts
import { HelpNest } from '@helpnest/sdk'

const client = new HelpNest({
  apiKey: 'hn_live_xxx',
  workspace: 'acme',
  baseUrl: 'https://help.acme.com', // optional, defaults to HelpNest Cloud
})
```

Authentication headers (`Authorization: Bearer <apiKey>` and `X-HelpNest-Workspace`) are set automatically on every request.

## Resources

### `client.articles`

| Method | Description |
|---|---|
| `list(params?)` | List articles. Filter by `collection`, `status`, or pagination params. |
| `get(idOrSlug)` | Fetch a single article by ID or slug. |
| `create(params)` | Create a new article. |
| `update(id, params)` | Partially update an article. |
| `delete(id)` | Archive or delete an article. |
| `search(query)` | Full-text search across articles. |
| `listVersions(articleId)` | Fetch version history for an article. |
| `createVersion(articleId, params)` | Snapshot the current article as a new version. |
| `export(params?)` | Bulk export published articles grouped by collection. Supports `format: 'markdown'` and pagination. |
| `changes(since, params?)` | Fetch articles changed since an ISO 8601 timestamp. Returns a cursor for incremental polling. |

### `client.collections`

| Method | Description |
|---|---|
| `list(params?)` | List collections. Filter by `isPublic` or `isArchived`. |
| `get(idOrSlug)` | Fetch a single collection by ID or slug. |
| `create(params)` | Create a collection (`title`, `description`, `emoji`, `slug`, `isPublic`, `parentId`). |
| `update(id, params)` | Partially update a collection. Supports order reordering. |
| `delete(id)` | Delete a collection. |

### `client.conversations`

| Method | Description |
|---|---|
| `list(params?)` | List conversations filtered by status, with pagination. |
| `get(id)` | Fetch a single conversation. |
| `create(params)` | Start a new conversation. `workspaceSlug` is required. |
| `updateStatus(id, status, resolutionSummary?)` | Transition conversation status. |
| `assign(id, memberId \| null)` | Assign to or unassign from a team member. |

### `client.messages`

| Method | Description |
|---|---|
| `list(conversationId, since?)` | Fetch messages, optionally filtered to those after a timestamp. |
| `send(conversationId, params)` | Send a message to a conversation. |

## Key Types

```ts
type ArticleStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'

type MemberRole = 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER'

type ConversationStatus =
  | 'ACTIVE'
  | 'ESCALATED'
  | 'HUMAN_ACTIVE'
  | 'RESOLVED_AI'
  | 'RESOLVED_HUMAN'
  | 'CLOSED'

type MessageRole = 'CUSTOMER' | 'AI' | 'AGENT' | 'SYSTEM'
```

All list responses follow the shape:

```ts
{
  data: T[]
  total: number
  page: number
  limit: number
}
```

## Error Handling

All API errors throw a `HelpNestError` instance. Inspect the `statusCode` property to branch on HTTP status codes.

```ts
import { HelpNestError } from '@helpnest/sdk'

try {
  await client.articles.get('nonexistent-slug')
} catch (err) {
  if (err instanceof HelpNestError && err.statusCode === 404) {
    // handle not found
  }
}
```

## Build

Built with `tsup` producing dual CJS and ESM output.
