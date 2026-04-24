export interface WidgetConfig {
  workspaceId: string
  name: string
  slug: string
  logo: string | null
  aiEnabled: boolean
  aiGreeting: string
  widgetResponseTime: string | null
  theme: {
    vars: Record<string, string>
    fontUrls: string[]
  }
}

export interface InitConfig {
  workspace: string
  baseUrl: string
  position: 'bottom-right' | 'bottom-left'
}

export type TabId = 'home' | 'messages' | 'help'

export interface CollectionNode {
  id: string
  title: string
  description: string | null
  slug: string
  articleCount: number
  subCollections: CollectionNode[]
}

export interface ArticleSummary {
  id: string
  title: string
  slug: string
  excerpt: string | null
  author: { name: string | null; avatar: string | null }
  updatedAt: string
}

export interface ArticleDetail {
  id: string
  title: string
  slug: string
  content: string
  excerpt: string | null
  author: { name: string | null; avatar: string | null }
  updatedAt: string
  collection: { title: string; slug: string }
  workspaceSlug: string
}

export interface ConversationSummary {
  id: string
  status: string
  subject: string | null
  lastMessage: {
    content: string
    role: string
    createdAt: string
  } | null
  createdAt: string
  updatedAt: string
}

export interface Source {
  id: string
  title: string
  slug: string
  collection: { slug: string; title: string }
}

export interface ConversationMessage {
  id: string
  role: 'CUSTOMER' | 'AI' | 'AGENT' | 'SYSTEM'
  content: string
  sources?: Source[]
  confidence?: number
  feedbackHelpful?: boolean | null
  createdAt: string
}

export type SSEEvent =
  | { type: 'text'; text: string }
  | { type: 'sources'; sources: Source[] }
  | { type: 'done'; shouldEscalate?: boolean; escalationReason?: string; message?: string; confidence?: number }
  | { type: 'error'; message?: string }

export type ViewType =
  | { kind: 'home' }
  | { kind: 'messages' }
  | { kind: 'help' }
  | { kind: 'chat'; conversationId?: string; forceNew?: boolean }
  | { kind: 'collection-detail'; collectionId: string; title: string }
  | { kind: 'article'; articleId: string }

export interface WidgetState {
  activeTab: TabId
  viewStack: ViewType[]
  config: WidgetConfig | null
  collections: CollectionNode[]
  conversations: ConversationSummary[]
  searchQuery: string
  searchResults: ArticleSummary[]
  isOpen: boolean
}
