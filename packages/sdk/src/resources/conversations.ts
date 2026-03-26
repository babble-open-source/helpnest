import type { HttpClient } from '../http'
import type {
  Conversation,
  ConversationMessage,
  ConversationStatus,
  CreateConversationParams,
  ListConversationsParams,
  PaginatedResponse,
  SendMessageParams,
} from '../types'

export class ConversationsResource {
  constructor(private http: HttpClient) {}

  /**
   * List conversations in the workspace.
   * Optionally filter by status or paginate.
   */
  async list(params?: ListConversationsParams): Promise<PaginatedResponse<Conversation>> {
    return this.http.get('/conversations', params as Record<string, string | number | boolean | undefined>)
  }

  /**
   * Get a single conversation by ID.
   */
  async get(id: string): Promise<Conversation> {
    return this.http.get(`/conversations/${id}`)
  }

  /**
   * Start a new conversation.
   */
  async create(params: CreateConversationParams): Promise<Conversation> {
    return this.http.post('/conversations', params)
  }

  /**
   * Update the status of a conversation.
   * Optionally provide a resolution summary when closing or resolving.
   */
  async updateStatus(id: string, status: ConversationStatus, resolutionSummary?: string): Promise<Conversation> {
    return this.http.patch(`/conversations/${id}`, { status, resolutionSummary })
  }

  /**
   * Assign a conversation to a team member. Pass null to unassign.
   */
  async assign(id: string, memberId: string | null): Promise<Conversation> {
    return this.http.post(`/conversations/${id}/assign`, { memberId })
  }

  /**
   * Get a count of escalated conversations.
   */
  async count(): Promise<{ escalated: number }> {
    return this.http.get('/conversations/count')
  }
}

export class MessagesResource {
  constructor(private http: HttpClient) {}

  /**
   * List messages in a conversation.
   * Optionally pass an ISO timestamp to fetch only messages since that point.
   */
  async list(conversationId: string, since?: string): Promise<{ messages: ConversationMessage[] }> {
    return this.http.get(
      `/conversations/${conversationId}/messages`,
      since ? { since } : undefined,
    )
  }

  /**
   * Send a message in a conversation.
   */
  async send(
    conversationId: string,
    params: SendMessageParams,
  ): Promise<{ message: ConversationMessage }> {
    return this.http.post(`/conversations/${conversationId}/messages`, params)
  }
}
