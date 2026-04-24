import type { ConversationMessage, Source } from './types'

const STORAGE_KEY_PREFIX = 'helpnest:chat:'
const SESSIONS_KEY_PREFIX = 'helpnest:sessions:'
const VISITOR_KEY_PREFIX = 'helpnest:visitor:'
const POLL_INTERVAL = 5000
const POLL_TIMEOUT = 10 * 60 * 1000 // 10 minutes

interface ChatSession {
  sessionToken: string
  conversationId: string
  lastMessageAt: number
}

export type ChatState = 'IDLE' | 'CHAT_AI' | 'CHAT_HUMAN' | 'RESOLVED'

export type SSEEvent =
  | { type: 'text'; text: string }
  | { type: 'sources'; sources: Source[] }
  | { type: 'done'; shouldEscalate?: boolean; escalationReason?: string; message?: string; confidence?: number }
  | { type: 'error'; message?: string }

export class ChatManager {
  private config: { workspace: string; baseUrl: string }
  private session: ChatSession | null = null
  private state: ChatState = 'IDLE'
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private onNewMessages: ((msgs: ConversationMessage[]) => void) | null = null

  constructor(config: { workspace: string; baseUrl: string }) {
    this.config = config
  }

  getState(): ChatState {
    return this.state
  }

  getSession(): ChatSession | null {
    return this.session
  }

  setSession(conversationId: string) {
    // Check sessions map first (covers all past conversations)
    const mapKey = SESSIONS_KEY_PREFIX + this.config.workspace
    const mapRaw = localStorage.getItem(mapKey)
    if (mapRaw) {
      try {
        const arr = JSON.parse(mapRaw) as Array<{ sessionToken: string; conversationId: string } | string>
        for (const entry of arr) {
          if (typeof entry === 'object' && entry.conversationId === conversationId) {
            this.session = { sessionToken: entry.sessionToken, conversationId, lastMessageAt: Date.now() }
            return
          }
        }
      } catch { /* ignore */ }
    }
    // Fallback: check single-chat storage (current session)
    const chatRaw = localStorage.getItem(STORAGE_KEY_PREFIX + this.config.workspace)
    if (chatRaw) {
      try {
        const session = JSON.parse(chatRaw) as ChatSession
        if (session.conversationId === conversationId) {
          this.session = session
          return
        }
      } catch { /* ignore */ }
    }
    // No token found — set partial session; loadMessages will auth via X-Visitor-Id
    this.session = { sessionToken: '', conversationId, lastMessageAt: Date.now() }
  }

  setOnNewMessages(cb: (msgs: ConversationMessage[]) => void) {
    this.onNewMessages = cb
  }

  clearSession() {
    this.stopPolling()
    this.session = null
    this.state = 'IDLE'
    localStorage.removeItem(STORAGE_KEY_PREFIX + this.config.workspace)
  }

  async resumeSession(): Promise<boolean> {
    const stored = localStorage.getItem(STORAGE_KEY_PREFIX + this.config.workspace)
    if (!stored) return false
    try {
      const session = JSON.parse(stored) as ChatSession
      const res = await fetch(
        `${this.config.baseUrl}/api/conversations/${session.conversationId}`,
        { headers: { 'X-Session-Token': session.sessionToken } }
      )
      if (!res.ok) {
        localStorage.removeItem(STORAGE_KEY_PREFIX + this.config.workspace)
        return false
      }
      const conv = await res.json() as { status: string }
      this.session = session
      this.updateState(conv.status)
      return true
    } catch {
      return false
    }
  }

  getVisitorId(): string {
    const key = VISITOR_KEY_PREFIX + this.config.workspace
    let id = localStorage.getItem(key)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(key, id)
    }
    return id
  }

  async createConversation(): Promise<{ greeting: string }> {
    const visitorId = this.getVisitorId()
    const res = await fetch(`${this.config.baseUrl}/api/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceSlug: this.config.workspace, visitorId }),
    })
    if (!res.ok) throw new Error('Failed to create conversation')
    const data = await res.json() as { id: string; sessionToken: string; greeting?: string }
    this.session = {
      sessionToken: data.sessionToken,
      conversationId: data.id,
      lastMessageAt: Date.now(),
    }
    this.saveSession()
    this.state = 'CHAT_AI'
    return { greeting: data.greeting ?? 'Hi! How can I help?' }
  }

  async *sendMessage(content: string): AsyncGenerator<SSEEvent> {
    if (!this.session) throw new Error('No active session')

    const res = await fetch(
      `${this.config.baseUrl}/api/conversations/${this.session.conversationId}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': this.session.sessionToken,
        },
        body: JSON.stringify({ content }),
      }
    )

    if (!res.ok) {
      const err = await res.json().catch(() => null) as { error?: string } | null
      throw new Error(err?.error ?? 'Failed to send message')
    }

    this.session.lastMessageAt = Date.now()
    this.saveSession()

    const contentType = res.headers.get('content-type') ?? ''
    if (!contentType.includes('text/event-stream')) {
      yield { type: 'done' }
      return
    }

    const reader = res.body?.getReader()
    if (!reader) return

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        try {
          const event = JSON.parse(line.slice(6)) as SSEEvent
          yield event
          if (event.type === 'done') {
            if (event.shouldEscalate) {
              this.state = 'CHAT_HUMAN'
              this.startPolling()
            }
            return
          }
        } catch {
          // skip invalid JSON lines
        }
      }
    }
  }

  async loadMessages(since?: string): Promise<ConversationMessage[]> {
    if (!this.session) return []
    const url = new URL(
      `${this.config.baseUrl}/api/conversations/${this.session.conversationId}/messages`
    )
    if (since) url.searchParams.set('since', since)
    const headers: Record<string, string> = {}
    if (this.session.sessionToken) {
      headers['X-Session-Token'] = this.session.sessionToken
    } else {
      // No stored session token (old conversation) — auth via stable visitorId
      headers['X-Visitor-Id'] = this.getVisitorId()
    }
    try {
      const res = await fetch(url.toString(), { headers })
      if (!res.ok) return []
      const data = await res.json() as { messages?: ConversationMessage[] }
      return data.messages ?? []
    } catch {
      return []
    }
  }

  async escalate(): Promise<void> {
    if (!this.session) return
    await fetch(
      `${this.config.baseUrl}/api/conversations/${this.session.conversationId}/escalate`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': this.session.sessionToken,
        },
      }
    )
    this.state = 'CHAT_HUMAN'
    this.startPolling()
  }

  async sendFeedback(messageId: string, helpful: boolean): Promise<void> {
    if (!this.session) return
    await fetch(
      `${this.config.baseUrl}/api/conversations/${this.session.conversationId}/feedback`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': this.session.sessionToken,
        },
        body: JSON.stringify({ messageId, helpful }),
      }
    )
  }

  // Called after a streaming AI response completes so the poll's `since`
  // timestamp advances past the AI message, preventing it being fetched again.
  advanceLastMessageAt() {
    if (this.session) {
      this.session.lastMessageAt = Date.now()
      this.saveSession()
    }
  }

  // --- Private helpers ---

  private saveSession() {
    if (this.session) {
      localStorage.setItem(
        STORAGE_KEY_PREFIX + this.config.workspace,
        JSON.stringify(this.session)
      )
      // Accumulate {sessionToken, conversationId} pairs so any past conversation can be loaded
      const key = SESSIONS_KEY_PREFIX + this.config.workspace
      const raw = localStorage.getItem(key)
      const existing = raw ? JSON.parse(raw) as Array<{ sessionToken: string; conversationId: string } | string> : []
      const alreadyStored = existing.some((e) =>
        typeof e === 'object' ? e.sessionToken === this.session!.sessionToken : e === this.session!.sessionToken
      )
      if (!alreadyStored && this.session.sessionToken) {
        existing.push({ sessionToken: this.session.sessionToken, conversationId: this.session.conversationId })
        localStorage.setItem(key, JSON.stringify(existing))
      }
    }
  }

  getAllSessionTokens(): string[] {
    const key = SESSIONS_KEY_PREFIX + this.config.workspace
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const arr = JSON.parse(raw) as Array<{ sessionToken: string; conversationId: string } | string>
    return arr.map((e) => (typeof e === 'string' ? e : e.sessionToken))
  }

  private updateState(status: string) {
    switch (status) {
      case 'ESCALATED':
      case 'HUMAN_ACTIVE':
        this.state = 'CHAT_HUMAN'
        this.startPolling()
        break
      case 'RESOLVED_AI':
      case 'RESOLVED_HUMAN':
      case 'CLOSED':
        this.state = 'RESOLVED'
        break
      default:
        this.state = 'CHAT_AI'
    }
  }

  private startPolling() {
    this.stopPolling()
    const startedAt = Date.now()
    this.pollTimer = setInterval(() => {
      void this.doPoll(startedAt)
    }, POLL_INTERVAL)
  }

  private async doPoll(startedAt: number) {
    if (Date.now() - (this.session?.lastMessageAt ?? startedAt) > POLL_TIMEOUT) {
      this.stopPolling()
      return
    }
    const since = new Date(this.session?.lastMessageAt ?? 0).toISOString()
    const msgs = await this.loadMessages(since)
    if (msgs.length > 0) {
      this.session!.lastMessageAt = Date.now()
      this.saveSession()
      this.onNewMessages?.(msgs)
    }
  }

  stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
  }
}
