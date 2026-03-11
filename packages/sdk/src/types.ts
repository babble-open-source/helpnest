export type ArticleStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
export type MemberRole = 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER'

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
  isPublic: boolean
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
  isPublic?: boolean
  isArchived?: boolean
}

export interface CreateCollectionParams {
  title: string
  description?: string
  emoji?: string
  slug?: string
  isPublic?: boolean
  isArchived?: boolean
  parentId?: string
}

export interface UpdateCollectionParams {
  title?: string
  description?: string
  emoji?: string
  slug?: string
  isPublic?: boolean
  isArchived?: boolean
  order?: number
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
}

export interface HelpNestConfig {
  apiKey: string
  workspace: string
  baseUrl?: string
}
