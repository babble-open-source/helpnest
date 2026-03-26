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
