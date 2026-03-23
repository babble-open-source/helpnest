export type ArticleStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
export type MemberRole = 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER'
export type CollectionVisibility = 'PUBLIC' | 'INTERNAL'

export interface Workspace {
  id: string
  name: string
  slug: string
  logo: string | null
  customDomain: string | null
  createdAt: string
  updatedAt: string
}

export interface Collection {
  id: string
  workspaceId: string
  title: string
  description: string | null
  icon: string | null
  emoji: string | null
  slug: string
  order: number
  visibility: CollectionVisibility
  isArchived: boolean
  parentId: string | null
  createdAt?: string
}

export interface Article {
  id: string
  workspaceId: string
  collectionId: string
  title: string
  slug: string
  content: string
  excerpt: string | null
  status: ArticleStatus
  order: number
  views: number
  helpful: number
  notHelpful: number
  authorId: string
  createdAt: string
  updatedAt: string
  publishedAt: string | null
}

export interface ArticleVersion {
  id: string
  articleId: string
  title: string
  content: string
  version: number
  authorId: string
  createdAt: string
}

export interface SearchResult {
  id: string
  title: string
  slug: string
  snippet: string
  collection: { title: string; slug: string }
  readTime: number
}

// Request/response types
export interface ListArticlesParams {
  collectionId?: string
  status?: ArticleStatus
  page?: number
  limit?: number
}

export interface CreateArticleParams {
  title: string
  content: string
  collectionId: string
  status?: ArticleStatus
  excerpt?: string
  slug?: string
}

export interface UpdateArticleParams {
  title?: string
  content?: string
  collectionId?: string
  status?: ArticleStatus
  excerpt?: string
  slug?: string
}

export interface ListCollectionsParams {
  visibility?: CollectionVisibility
  isArchived?: boolean
}

export interface CreateCollectionParams {
  title: string
  description?: string
  emoji?: string
  slug?: string
  visibility?: CollectionVisibility
  isArchived?: boolean
  parentId?: string
}

export interface UpdateCollectionParams {
  title?: string
  description?: string
  emoji?: string
  slug?: string
  visibility?: CollectionVisibility
  isArchived?: boolean
  order?: number
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
}

// Conversation types
export type ConversationStatus = 'ACTIVE' | 'ESCALATED' | 'RESOLVED_AI' | 'RESOLVED_HUMAN' | 'CLOSED'
export type MessageRole = 'CUSTOMER' | 'AI' | 'AGENT' | 'SYSTEM'

export interface Conversation {
  id: string
  workspaceId: string
  status: ConversationStatus
  customerName: string | null
  customerEmail: string | null
  sessionToken?: string
  subject: string | null
  aiConfidence: number | null
  escalationReason: string | null
  resolutionSummary: string | null
  assignedTo?: { name: string | null; email: string } | null
  messageCount?: number
  firstMessage?: string | null
  createdAt: string
  updatedAt: string
}

export interface ConversationMessage {
  id: string
  conversationId: string
  role: MessageRole
  content: string
  sources?: unknown
  confidence: number | null
  feedbackHelpful: boolean | null
  createdAt: string
}

export interface CreateConversationParams {
  workspaceSlug: string
  customerName?: string
  customerEmail?: string
}

export interface ListConversationsParams {
  status?: ConversationStatus
  page?: number
  limit?: number
}

export interface SendMessageParams {
  content: string
}

export interface HelpNestConfig {
  apiKey: string
  workspace: string
  baseUrl?: string
}

// ── Export / change-feed types ───────────────────────────────────────────────

export interface ExportArticle {
  title: string
  slug: string
  content: string
  updatedAt: string
}

export interface ExportCollection {
  title: string
  slug: string
  articles: ExportArticle[]
}

export interface ExportResponse {
  workspace: string
  exportedAt: string
  collections: ExportCollection[]
}

export interface ChangeFeedEntry {
  id: string
  slug: string
  title: string
  action: 'created' | 'updated' | 'published' | 'archived'
  updatedAt: string
  collectionSlug: string
}

export interface ChangeFeedResponse {
  changes: ChangeFeedEntry[]
  cursor: string | null
}
