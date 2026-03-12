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

export interface WidgetConfig {
  workspace: string
  baseUrl: string
  position: 'bottom-right' | 'bottom-left'
  title: string
  mode: 'chat' | 'search'
  greeting: string
}
