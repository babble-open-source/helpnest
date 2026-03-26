export interface CrawlConfig {
  url: string
  workspaceId: string
  workspaceName: string
  collectionId?: string
  maxContentLength?: number
}

export interface PageContent {
  url: string
  title: string
  markdown: string
  contentType: 'marketing' | 'docs' | 'app-ui' | 'other'
  language: string | null
  sensitiveDataWarnings: string[]
}

export interface ArticleDraft {
  title: string
  content: string
  excerpt: string
  suggestedCollection: string | null
  confidence: number
}

export interface CrawlResult {
  success: boolean
  page: PageContent | null
  article: ArticleDraft | null
  error: string | null
  skipped: boolean
  skipReason: string | null
}

export interface DiscoveredLink {
  url: string
  anchorText: string
  context: string
}

export interface FilteredLink {
  url: string
  anchorText: string
  reason: string
  priority: 'high' | 'medium' | 'low'
}

export interface LinkFilterResult {
  mode: 'focused' | 'discovery'
  selectedLinks: FilteredLink[]
  totalDiscovered: number
}

export interface GoalPromptInput {
  markdown: string
  title: string
  url: string
  contentType: 'marketing' | 'docs' | 'app-ui' | 'other'
  workspaceName: string
  existingCollections: string[]
  goal: string
  seriesContext?: {
    articleNumber: number
    totalArticles: number
    previousTitles: string[]
  }
}
