import { styles } from './styles'
import { searchArticles } from './search'
import { ChatManager } from './chat'
import type { WidgetConfig, Source, ConversationMessage } from './types'

export type { WidgetConfig }

interface ThemePayload {
  vars?: Record<string, string>
  fontUrls?: string[]
  logoUrl?: string | null
  brandText?: string | null
}

export class HelpPanel {
  private config: WidgetConfig
  private container: HTMLElement | null = null
  private panel: HTMLElement | null = null
  private isOpen = false

  // Search mode state
  private searchTimer: ReturnType<typeof setTimeout> | null = null
  private aiMode = false
  private aiInFlight = false
  private aiAbortController: AbortController | null = null

  // Chat mode state
  private chatManager: ChatManager | null = null
  private chatStreaming = false
  private messageCount = 0

  constructor(config: WidgetConfig) {
    this.config = config
    if (config.mode === 'chat') {
      this.chatManager = new ChatManager({
        workspace: config.workspace,
        baseUrl: config.baseUrl,
      })
    }
  }

  mount() {
    if (!document.getElementById('helpnest-styles')) {
      const style = document.createElement('style')
      style.id = 'helpnest-styles'
      style.textContent = styles
      document.head.appendChild(style)
    }

    this.container = document.createElement('div')
    this.container.id = 'helpnest-launcher'
    if (this.config.position === 'bottom-left') {
      this.container.classList.add('position-left')
    }

    this.container.innerHTML = this.renderPanel() + this.renderButton()
    document.body.appendChild(this.container)

    this.panel = this.container.querySelector('#helpnest-panel')
    void this.applyWorkspaceTheme()
    this.bindEvents()

    if (this.config.mode === 'chat') {
      void this.initChat()
    }
  }

  // ─── Rendering ──────────────────────────────────────────────────────────────

  private renderButton(): string {
    return `
      <button id="helpnest-btn" aria-label="Help">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round"
            d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>
    `
  }

  private renderPanel(): string {
    const helpCenterUrl = `${this.config.baseUrl}/${this.config.workspace}/help`
    const isChatMode = this.config.mode === 'chat'

    if (isChatMode) {
      return `
        <div id="helpnest-panel" class="hidden hn-chat-mode">
          <div class="hn-panel-header">
            <div class="hn-panel-brand">
              <img class="hn-panel-logo" alt="" />
              <span class="hn-panel-logo-text" style="display:none"></span>
            </div>
            <h3>${this.escapeHtml(this.config.title)}</h3>
          </div>
          <div class="hn-panel-body">
            <div class="hn-chat-messages" id="hn-chat-messages"></div>
            <div class="hn-chat-status status-ai" id="hn-chat-status" style="display:none"></div>
            <div class="hn-chat-composer">
              <textarea
                class="hn-chat-input"
                id="hn-chat-input"
                rows="1"
                maxlength="1000"
                placeholder="Type a message..."
                autocomplete="off"
                spellcheck="false"
              ></textarea>
              <button class="hn-chat-send" id="hn-chat-send" type="button" aria-label="Send">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
          <div class="hn-panel-footer">
            <a href="${helpCenterUrl}" target="_blank" class="hn-footer-btn hn-browse-btn">
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              Browse articles
            </a>
          </div>
          <p class="hn-powered">Powered by <a href="https://helpnest.cloud" target="_blank">HelpNest</a></p>
        </div>
      `
    }

    // Search mode
    return `
      <div id="helpnest-panel" class="hidden">
        <div class="hn-panel-header">
          <div class="hn-panel-brand">
            <img class="hn-panel-logo" alt="" />
            <span class="hn-panel-logo-text" style="display:none"></span>
          </div>
          <h3>${this.escapeHtml(this.config.title)}</h3>
          <p class="hn-ai-header-note" style="display:none">AI answers are based on published help articles.</p>
          <div class="hn-search-wrap">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              class="hn-search-input"
              placeholder="Search for answers..."
              autocomplete="off"
              spellcheck="false"
            />
          </div>
        </div>
        <div class="hn-panel-body">
          <ul class="hn-results-list">
            <li class="hn-empty">Type to search or browse our help center</li>
          </ul>
          <div class="hn-ai-view" style="display:none">
            <div class="hn-ai-output">
              <p class="hn-ai-status"></p>
              <div class="hn-ai-answer"></div>
              <div class="hn-ai-sources-wrap" style="display:none">
                <p class="hn-ai-sources-title">Sources</p>
                <ul class="hn-ai-sources"></ul>
              </div>
            </div>
            <div class="hn-ai-composer">
              <div class="hn-ai-head">
                <p class="hn-ai-helper">Ask a question about this help center.</p>
              </div>
              <form class="hn-ai-form">
                <textarea
                  class="hn-ai-input"
                  rows="3"
                  maxlength="500"
                  placeholder="e.g. How do I reset my workspace password?"
                ></textarea>
                <div class="hn-ai-actions">
                  <button type="button" class="hn-ai-back">Back to Search</button>
                  <button type="submit" class="hn-ai-submit">Ask AI</button>
                </div>
              </form>
            </div>
          </div>
        </div>
        <div class="hn-panel-footer">
          <a href="${helpCenterUrl}" target="_blank" class="hn-footer-btn hn-browse-btn">
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            Browse all articles
          </a>
          <button class="hn-footer-btn hn-ai-btn" id="hn-ai-toggle" type="button">
            ✦ Ask AI
          </button>
        </div>
        <p class="hn-powered">Powered by <a href="https://helpnest.cloud" target="_blank">HelpNest</a></p>
      </div>
    `
  }

  // ─── Event binding ───────────────────────────────────────────────────────────

  private bindEvents() {
    const btn = this.container?.querySelector('#helpnest-btn')
    btn?.addEventListener('click', () => this.toggle())

    // Close on outside click.
    // Use composedPath() instead of contains() so that buttons which remove
    // themselves from the DOM before the event finishes bubbling (e.g. "Talk
    // to a human", "Start new conversation") don't accidentally trigger a close.
    document.addEventListener('click', (e) => {
      if (this.isOpen && this.container && !e.composedPath().includes(this.container)) {
        this.close()
      }
    })

    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) this.close()
    })

    if (this.config.mode === 'chat') {
      this.bindChatEvents()
    } else {
      this.bindSearchEvents()
    }
  }

  private bindSearchEvents() {
    const input = this.container?.querySelector('.hn-search-input') as HTMLInputElement | null
    const aiToggle = this.container?.querySelector('#hn-ai-toggle') as HTMLButtonElement | null
    const aiForm = this.container?.querySelector('.hn-ai-form') as HTMLFormElement | null
    const aiInput = this.container?.querySelector('.hn-ai-input') as HTMLTextAreaElement | null
    const aiBack = this.container?.querySelector('.hn-ai-back') as HTMLButtonElement | null

    aiToggle?.addEventListener('click', () => {
      this.setAIMode(!this.aiMode)
      if (this.aiMode) aiInput?.focus()
    })
    aiBack?.addEventListener('click', () => this.setAIMode(false))

    input?.addEventListener('input', () => {
      if (this.aiMode) return
      if (this.searchTimer) clearTimeout(this.searchTimer)
      this.searchTimer = setTimeout(() => {
        this.handleSearch(input.value.trim())
      }, 300)
    })

    aiForm?.addEventListener('submit', (e) => {
      e.preventDefault()
      if (!aiInput) return
      void this.askAI(aiInput.value)
    })

    aiInput?.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return
      e.preventDefault()
      void this.askAI(aiInput.value)
    })
  }

  private bindChatEvents() {
    const input = this.container?.querySelector('#hn-chat-input') as HTMLTextAreaElement | null
    const sendBtn = this.container?.querySelector('#hn-chat-send') as HTMLButtonElement | null

    const submit = () => {
      const text = input?.value.trim() ?? ''
      if (!text || this.chatStreaming) return
      void this.sendChatMessage(text)
    }

    sendBtn?.addEventListener('click', submit)

    input?.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return
      e.preventDefault()
      submit()
    })

    // Auto-resize textarea (single-line feel, max 4 lines)
    input?.addEventListener('input', () => {
      if (!input) return
      input.style.height = 'auto'
      input.style.height = Math.min(input.scrollHeight, 96) + 'px'
    })
  }

  // ─── Open / close ────────────────────────────────────────────────────────────

  private toggle() {
    this.isOpen ? this.close() : this.open()
  }

  private open() {
    this.isOpen = true
    this.panel?.classList.remove('hidden')
    void this.applyWorkspaceTheme()

    setTimeout(() => {
      if (this.config.mode === 'chat') {
        const input = this.container?.querySelector('#hn-chat-input') as HTMLTextAreaElement | null
        input?.focus()
      } else if (this.aiMode) {
        const aiInput = this.container?.querySelector('.hn-ai-input') as HTMLTextAreaElement | null
        aiInput?.focus()
      } else {
        const input = this.container?.querySelector('.hn-search-input') as HTMLInputElement | null
        input?.focus()
      }
    }, 100)
  }

  private close() {
    this.isOpen = false
    this.panel?.classList.add('hidden')
    if (this.config.mode === 'search') {
      this.setAIMode(false)
    }
  }

  // ─── Search mode methods (unchanged logic) ───────────────────────────────────

  private async handleSearch(query: string) {
    const list = this.panel?.querySelector('.hn-results-list')
    if (!list) return

    if (query.length < 2) {
      list.innerHTML = '<li class="hn-empty">Type to search or browse our help center</li>'
      return
    }

    list.innerHTML = `
      <li style="padding:8px 12px"><div class="hn-skeleton" style="width:80%"></div><div class="hn-skeleton" style="width:50%"></div></li>
      <li style="padding:8px 12px"><div class="hn-skeleton" style="width:70%"></div><div class="hn-skeleton" style="width:40%"></div></li>
    `

    const results = await searchArticles(query, this.config.workspace, this.config.baseUrl)

    if (results.length === 0) {
      list.innerHTML = `<li class="hn-empty">No results for "<strong>${this.escapeHtml(query)}</strong>"</li>`
      return
    }

    list.innerHTML = results.map((r) => `
      <li class="hn-result-item" data-url="${this.config.baseUrl}/${this.config.workspace}/help/${r.collection.slug}/${r.slug}">
        <p class="hn-result-title">${this.escapeHtml(r.title)}</p>
        <p class="hn-result-meta">${this.escapeHtml(r.collection.title)} · ${r.readTime} min read</p>
      </li>
    `).join('')

    list.querySelectorAll('.hn-result-item').forEach((item) => {
      item.addEventListener('click', () => {
        const url = (item as HTMLElement).dataset['url']
        if (url) window.open(url, '_blank')
      })
    })
  }

  private setAIMode(enabled: boolean) {
    this.aiMode = enabled

    const searchList = this.container?.querySelector('.hn-results-list') as HTMLElement | null
    const aiView = this.container?.querySelector('.hn-ai-view') as HTMLElement | null
    const searchWrap = this.container?.querySelector('.hn-search-wrap') as HTMLElement | null
    const footer = this.container?.querySelector('.hn-panel-footer') as HTMLElement | null
    const searchInput = this.container?.querySelector('.hn-search-input') as HTMLInputElement | null
    const headerNote = this.container?.querySelector('.hn-ai-header-note') as HTMLElement | null
    const statusEl = this.container?.querySelector('.hn-ai-status') as HTMLElement | null

    if (searchList) searchList.style.display = enabled ? 'none' : ''
    if (aiView) aiView.style.display = enabled ? '' : 'none'
    if (searchWrap) searchWrap.style.display = enabled ? 'none' : ''
    if (footer) footer.style.display = enabled ? 'none' : ''
    if (searchInput) searchInput.disabled = enabled
    if (headerNote) headerNote.style.display = enabled ? '' : 'none'
    if (statusEl) statusEl.textContent = ''
    if (!enabled) this.cancelAIRequest()
    if (this.panel) this.panel.classList.toggle('hn-ai-mode', enabled)
  }

  private async askAI(rawQuery: string) {
    if (this.aiInFlight) return

    const query = rawQuery.trim()
    const statusEl = this.container?.querySelector('.hn-ai-status') as HTMLElement | null
    const answerEl = this.container?.querySelector('.hn-ai-answer') as HTMLElement | null
    const sourcesWrapEl = this.container?.querySelector('.hn-ai-sources-wrap') as HTMLElement | null
    const sourcesEl = this.container?.querySelector('.hn-ai-sources') as HTMLElement | null
    const submitBtn = this.container?.querySelector('.hn-ai-submit') as HTMLButtonElement | null
    const input = this.container?.querySelector('.hn-ai-input') as HTMLTextAreaElement | null

    if (!statusEl || !answerEl || !sourcesEl || !sourcesWrapEl || !submitBtn || !input) return

    if (query.length < 2) {
      statusEl.textContent = 'Enter at least 2 characters.'
      return
    }
    if (query.length > 500) {
      statusEl.textContent = 'Question must be 500 characters or fewer.'
      return
    }

    this.aiInFlight = true
    this.cancelAIRequest()
    const abortController = new AbortController()
    this.aiAbortController = abortController

    submitBtn.disabled = true
    input.disabled = true
    statusEl.textContent = 'Searching and drafting answer...'
    let answerText = ''
    answerEl.innerHTML = ''
    sourcesWrapEl.style.display = 'none'
    sourcesEl.innerHTML = ''

    let renderTimer: ReturnType<typeof setTimeout> | null = null
    let renderedText = ''
    const flushRender = () => {
      renderTimer = null
      if (renderedText === answerText) return
      answerEl.innerHTML = this.renderAnswerMarkdown(answerText)
      renderedText = answerText
    }
    const queueRender = () => {
      if (renderTimer) return
      renderTimer = setTimeout(flushRender, 60)
    }

    try {
      const res = await fetch(`${this.config.baseUrl}/api/ai-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, workspaceSlug: this.config.workspace }),
        signal: abortController.signal,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => null) as { error?: string } | null
        throw new Error(err?.error ?? 'AI service returned an error')
      }

      const contentType = res.headers.get('content-type') ?? ''
      if (!contentType.includes('text/event-stream')) {
        const data = await res.json() as { answer?: string; sources?: Source[] }
        answerText = data.answer ?? 'No answer returned.'
        flushRender()
        this.renderAISources(data.sources ?? [])
        statusEl.textContent = ''
        return
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No response stream available')

      const decoder = new TextDecoder()
      let buffer = ''
      let completed = false

      while (!completed) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = line.slice(6)
          if (!payload) continue

          try {
            const event = JSON.parse(payload) as
              | { type: 'sources'; sources: Source[] }
              | { type: 'text'; text: string }
              | { type: 'done' }
              | { type: 'error'; message?: string }

            if (event.type === 'sources') {
              this.renderAISources(event.sources)
            } else if (event.type === 'text') {
              answerText += event.text
              queueRender()
              statusEl.textContent = 'Generating answer...'
            } else if (event.type === 'done') {
              if (renderTimer) clearTimeout(renderTimer)
              flushRender()
              statusEl.textContent = ''
              completed = true
              break
            } else if (event.type === 'error') {
              throw new Error(event.message ?? 'AI service error')
            }
          } catch (e) {
            if (e instanceof Error) throw e
          }
        }
      }
    } catch (err) {
      if (renderTimer) clearTimeout(renderTimer)
      if (err instanceof DOMException && err.name === 'AbortError') {
        statusEl.textContent = ''
        return
      }
      const message = err instanceof Error ? err.message : 'Failed to get AI answer'
      statusEl.textContent = `Error: ${message}`
    } finally {
      const isLatestRequest = this.aiAbortController === abortController
      if (isLatestRequest) {
        this.aiAbortController = null
      }
      if (!isLatestRequest && this.aiAbortController) {
        return
      }
      this.aiInFlight = false
      submitBtn.disabled = false
      input.disabled = false
      if (this.isOpen && this.aiMode) input.focus()
    }
  }

  private cancelAIRequest() {
    if (!this.aiAbortController) return
    this.aiAbortController.abort()
    this.aiAbortController = null
    this.aiInFlight = false
  }

  private renderAISources(sources: Source[]) {
    const sourcesWrapEl = this.container?.querySelector('.hn-ai-sources-wrap') as HTMLElement | null
    const sourcesEl = this.container?.querySelector('.hn-ai-sources') as HTMLElement | null
    if (!sourcesEl || !sourcesWrapEl) return
    if (sources.length === 0) {
      sourcesWrapEl.style.display = 'none'
      sourcesEl.innerHTML = ''
      return
    }
    sourcesWrapEl.style.display = ''

    sourcesEl.innerHTML = sources.map((source) => {
      const url = `${this.config.baseUrl}/${this.config.workspace}/help/${source.collection.slug}/${source.slug}`
      return `
        <li class="hn-ai-source">
          <a href="${url}" target="_blank" rel="noopener noreferrer">
            ${this.escapeHtml(source.title)}
          </a>
          <span>${this.escapeHtml(source.collection.title)}</span>
        </li>
      `
    }).join('')
  }

  // ─── Chat mode methods ───────────────────────────────────────────────────────

  private async initChat() {
    if (!this.chatManager) return

    this.chatManager.setOnNewMessages((msgs) => {
      this.appendChatMessages(msgs)
      this.updateChatStatus()
    })

    const resumed = await this.chatManager.resumeSession()
    if (resumed) {
      // Load existing messages
      const messages = await this.chatManager.loadMessages()
      if (messages.length > 0) {
        this.appendChatMessages(messages)
        this.messageCount = messages.length
        this.updateChatStatus()
        return
      }
    }

    // Show greeting for new sessions
    this.appendGreeting(this.config.greeting)
  }

  private appendGreeting(text: string) {
    const list = this.container?.querySelector('#hn-chat-messages')
    if (!list) return

    const wrap = document.createElement('div')
    wrap.className = 'hn-chat-bubble-wrap ai'

    const bubble = document.createElement('div')
    bubble.className = 'hn-chat-bubble ai hn-chat-greeting'
    bubble.innerHTML = this.renderAnswerMarkdown(text)

    wrap.appendChild(bubble)
    list.appendChild(wrap)
    this.scrollChatToBottom()
  }

  private async sendChatMessage(text: string) {
    if (!this.chatManager || this.chatStreaming) return

    const input = this.container?.querySelector('#hn-chat-input') as HTMLTextAreaElement | null
    const sendBtn = this.container?.querySelector('#hn-chat-send') as HTMLButtonElement | null

    // Clear and disable input immediately
    if (input) {
      input.value = ''
      input.style.height = 'auto'
      input.disabled = true
    }
    if (sendBtn) sendBtn.disabled = true

    this.chatStreaming = true
    this.messageCount++

    // Append customer bubble
    this.appendCustomerBubble(text)

    try {
      // Create conversation on first real message if needed
      if (!this.chatManager.getSession()) {
        await this.chatManager.createConversation()
      }

      // Show typing indicator
      const typingEl = this.appendTypingIndicator()
      this.updateChatStatus('typing')

      let aiText = ''
      let aiBubble: HTMLElement | null = null
      let aiBubbleWrap: HTMLElement | null = null
      let pendingSources: Source[] = []
      let renderTimer: ReturnType<typeof setTimeout> | null = null
      let renderedText = ''

      const flushRender = () => {
        renderTimer = null
        if (!aiBubble || renderedText === aiText) return
        aiBubble.innerHTML = this.renderAnswerMarkdown(aiText)
        renderedText = aiText
        this.scrollChatToBottom()
      }

      const queueRender = () => {
        if (renderTimer) return
        renderTimer = setTimeout(flushRender, 60)
      }

      for await (const event of this.chatManager.sendMessage(text)) {
        if (event.type === 'text') {
          // Remove typing indicator and create AI bubble on first text chunk
          if (!aiBubble) {
            typingEl.remove()
            const { wrap, bubble } = this.createAiBubble()
            aiBubbleWrap = wrap
            aiBubble = bubble
            const list = this.container?.querySelector('#hn-chat-messages')
            list?.appendChild(wrap)
          }
          aiText += event.text
          queueRender()

        } else if (event.type === 'sources') {
          pendingSources = event.sources

        } else if (event.type === 'done') {
          if (renderTimer) clearTimeout(renderTimer)
          flushRender()

          // Render sources as chips
          if (pendingSources.length > 0 && aiBubbleWrap) {
            const chipsEl = this.buildSourceChips(pendingSources)
            aiBubbleWrap.appendChild(chipsEl)
          }

          // Render feedback buttons — only if this was a substantial AI reply
          if (aiText.length > 0 && aiBubbleWrap) {
            const msgId = `msg_${Date.now()}`
            if (aiBubbleWrap.dataset) aiBubbleWrap.dataset['msgId'] = msgId
            const feedbackEl = this.buildFeedbackButtons(msgId)
            aiBubbleWrap.appendChild(feedbackEl)
          }

          // Show "Talk to a human" after 3 messages or low confidence
          const lowConfidence =
            'confidence' in event && typeof event.confidence === 'number' && event.confidence < 0.5
          if ((this.messageCount >= 3 || lowConfidence) && !this.hasEscalateButton()) {
            this.appendEscalateButton()
          }

          // Handle escalation
          if (event.shouldEscalate) {
            // If AI sent no text, the typing indicator is still in the DOM — remove it
            if (!aiBubble) typingEl.remove()
            if (aiText.length === 0) {
              const reason = event.escalationReason ?? "Let me connect you with a support agent."
              this.appendSystemMessage(reason)
            }
            this.updateChatStatus()
          }

          // Advance lastMessageAt so the poll won't re-fetch this AI message.
          if (aiText.length > 0) this.chatManager.advanceLastMessageAt()

          this.scrollChatToBottom()
          break

        } else if (event.type === 'error') {
          typingEl.remove()
          this.appendSystemMessage(event.message ?? 'Something went wrong. Please try again.')
          break
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send message'
      this.appendSystemMessage(msg)
    } finally {
      this.chatStreaming = false
      if (input) input.disabled = false
      if (sendBtn) sendBtn.disabled = false
      if (input && this.isOpen) input.focus()
      this.updateChatStatus()
    }
  }

  private appendCustomerBubble(text: string) {
    const list = this.container?.querySelector('#hn-chat-messages')
    if (!list) return

    const wrap = document.createElement('div')
    wrap.className = 'hn-chat-bubble-wrap customer'

    const bubble = document.createElement('div')
    bubble.className = 'hn-chat-bubble customer'
    bubble.textContent = text

    wrap.appendChild(bubble)
    list.appendChild(wrap)
    this.scrollChatToBottom()
  }

  private createAiBubble(): { wrap: HTMLElement; bubble: HTMLElement } {
    const wrap = document.createElement('div')
    wrap.className = 'hn-chat-bubble-wrap ai'

    const bubble = document.createElement('div')
    bubble.className = 'hn-chat-bubble ai'

    wrap.appendChild(bubble)
    return { wrap, bubble }
  }

  private appendTypingIndicator(): HTMLElement {
    const list = this.container?.querySelector('#hn-chat-messages')
    const el = document.createElement('div')
    el.className = 'hn-chat-typing'
    el.innerHTML = '<span></span><span></span><span></span>'
    list?.appendChild(el)
    this.scrollChatToBottom()
    return el
  }

  private appendSystemMessage(text: string) {
    const list = this.container?.querySelector('#hn-chat-messages')
    if (!list) return

    const wrap = document.createElement('div')
    wrap.className = 'hn-chat-bubble-wrap system'

    const bubble = document.createElement('div')
    bubble.className = 'hn-chat-bubble system'
    bubble.textContent = text

    wrap.appendChild(bubble)
    list.appendChild(wrap)
    this.scrollChatToBottom()
  }

  private appendChatMessages(messages: ConversationMessage[]) {
    const list = this.container?.querySelector('#hn-chat-messages')
    if (!list) return

    for (const msg of messages) {
      const roleClass =
        msg.role === 'CUSTOMER' ? 'customer' :
        msg.role === 'AI' ? 'ai' :
        msg.role === 'AGENT' ? 'agent' :
        'system'

      const wrap = document.createElement('div')
      wrap.className = `hn-chat-bubble-wrap ${roleClass}`

      const bubble = document.createElement('div')
      bubble.className = `hn-chat-bubble ${roleClass}`

      if (msg.role === 'CUSTOMER' || msg.role === 'SYSTEM') {
        bubble.textContent = msg.content
      } else {
        bubble.innerHTML = this.renderAnswerMarkdown(msg.content)
      }

      wrap.appendChild(bubble)

      // Source chips for AI/AGENT messages
      if ((msg.role === 'AI' || msg.role === 'AGENT') && msg.sources && msg.sources.length > 0) {
        wrap.appendChild(this.buildSourceChips(msg.sources))
      }

      // Feedback buttons for AI messages
      if (msg.role === 'AI') {
        const feedbackEl = this.buildFeedbackButtons(msg.id)
        if (msg.feedbackHelpful === true) {
          feedbackEl.querySelector('.hn-chat-feedback-btn[data-vote="up"]')
            ?.classList.add('active-up')
        } else if (msg.feedbackHelpful === false) {
          feedbackEl.querySelector('.hn-chat-feedback-btn[data-vote="down"]')
            ?.classList.add('active-down')
        }
        wrap.appendChild(feedbackEl)
      }

      list.appendChild(wrap)
      this.messageCount++
    }

    // Show escalate button if we have enough history and haven't already
    if (this.messageCount >= 3 && !this.hasEscalateButton()) {
      this.appendEscalateButton()
    }

    this.scrollChatToBottom()
  }

  private buildSourceChips(sources: Source[]): HTMLElement {
    const container = document.createElement('div')
    container.className = 'hn-chat-sources'

    for (const source of sources) {
      const url = `${this.config.baseUrl}/${this.config.workspace}/help/${source.collection.slug}/${source.slug}`
      const chip = document.createElement('a')
      chip.className = 'hn-chat-source-chip'
      chip.href = url
      chip.target = '_blank'
      chip.rel = 'noopener noreferrer'
      chip.title = source.title
      chip.innerHTML = `
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        ${this.escapeHtml(source.title)}
      `
      container.appendChild(chip)
    }

    return container
  }

  private buildFeedbackButtons(messageId: string): HTMLElement {
    const container = document.createElement('div')
    container.className = 'hn-chat-feedback'

    const label = document.createElement('span')
    label.className = 'hn-chat-feedback-label'
    label.textContent = 'Helpful?'

    const upBtn = document.createElement('button')
    upBtn.className = 'hn-chat-feedback-btn'
    upBtn.type = 'button'
    upBtn.dataset['vote'] = 'up'
    upBtn.setAttribute('aria-label', 'Helpful')
    upBtn.textContent = '👍'

    const downBtn = document.createElement('button')
    downBtn.className = 'hn-chat-feedback-btn'
    downBtn.type = 'button'
    downBtn.dataset['vote'] = 'down'
    downBtn.setAttribute('aria-label', 'Not helpful')
    downBtn.textContent = '👎'

    const handleFeedback = (helpful: boolean) => {
      upBtn.disabled = true
      downBtn.disabled = true
      upBtn.classList.toggle('active-up', helpful)
      downBtn.classList.toggle('active-down', !helpful)
      void this.chatManager?.sendFeedback(messageId, helpful)
    }

    upBtn.addEventListener('click', () => handleFeedback(true))
    downBtn.addEventListener('click', () => handleFeedback(false))

    container.appendChild(label)
    container.appendChild(upBtn)
    container.appendChild(downBtn)
    return container
  }

  private hasEscalateButton(): boolean {
    return !!this.container?.querySelector('.hn-chat-escalate')
  }

  private appendEscalateButton() {
    const list = this.container?.querySelector('#hn-chat-messages')
    if (!list) return

    const state = this.chatManager?.getState()
    // Don't show if already escalated or resolved
    if (state === 'CHAT_HUMAN' || state === 'RESOLVED') return

    const wrap = document.createElement('div')
    wrap.className = 'hn-chat-escalate-wrap'

    const btn = document.createElement('button')
    btn.className = 'hn-chat-escalate'
    btn.type = 'button'
    btn.innerHTML = `
      <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
      Talk to a human
    `
    btn.addEventListener('click', () => {
      wrap.remove()
      void this.handleEscalate()
    })

    wrap.appendChild(btn)
    list.appendChild(wrap)
    this.scrollChatToBottom()
  }

  private async handleEscalate() {
    if (!this.chatManager) return

    // Ensure a session exists before escalating
    if (!this.chatManager.getSession()) {
      try {
        await this.chatManager.createConversation()
      } catch {
        this.appendSystemMessage('Unable to connect. Please try again.')
        return
      }
    }

    this.appendSystemMessage('Connecting you to a support agent...')
    try {
      await this.chatManager.escalate()
      this.updateChatStatus()
    } catch {
      this.appendSystemMessage('Failed to connect to support. Please try again.')
    }
  }

  private updateChatStatus(hint?: 'typing') {
    const statusEl = this.container?.querySelector('#hn-chat-status') as HTMLElement | null
    if (!statusEl) return

    const state = this.chatManager?.getState() ?? 'IDLE'

    if (hint === 'typing') {
      statusEl.style.display = 'flex'
      statusEl.className = 'hn-chat-status status-ai'
      statusEl.innerHTML = '<span class="hn-chat-status-dot pulse"></span> AI is typing...'
      return
    }

    if (state === 'CHAT_HUMAN') {
      statusEl.style.display = 'flex'
      statusEl.className = 'hn-chat-status status-human'
      statusEl.innerHTML = '<span class="hn-chat-status-dot pulse"></span> Connected to support'
      return
    }

    if (state === 'RESOLVED') {
      statusEl.style.display = 'flex'
      statusEl.className = 'hn-chat-status status-resolved'
      statusEl.innerHTML = '<span class="hn-chat-status-dot"></span> Conversation resolved'
      const input = this.container?.querySelector('#hn-chat-input') as HTMLTextAreaElement | null
      const sendBtn = this.container?.querySelector('#hn-chat-send') as HTMLButtonElement | null
      if (input) { input.disabled = true; input.placeholder = 'This conversation is resolved.' }
      if (sendBtn) sendBtn.disabled = true
      // Show "Start new conversation" button if not already shown
      if (!this.container?.querySelector('.hn-chat-new-conv')) {
        const list = this.container?.querySelector('#hn-chat-messages')
        if (list) {
          const wrap = document.createElement('div')
          wrap.className = 'hn-chat-bubble-wrap system'
          const btn = document.createElement('button')
          btn.className = 'hn-chat-new-conv'
          btn.type = 'button'
          btn.textContent = 'Start a new conversation'
          btn.addEventListener('click', () => this.startNewConversation())
          wrap.appendChild(btn)
          list.appendChild(wrap)
          this.scrollChatToBottom()
        }
      }
      return
    }

    statusEl.style.display = 'none'
    statusEl.innerHTML = ''
  }

  private startNewConversation() {
    if (!this.chatManager) return

    // Clear session and state
    this.chatManager.clearSession()
    this.messageCount = 0

    // Clear message list
    const list = this.container?.querySelector('#hn-chat-messages')
    if (list) list.innerHTML = ''

    // Re-enable input
    const input = this.container?.querySelector('#hn-chat-input') as HTMLTextAreaElement | null
    const sendBtn = this.container?.querySelector('#hn-chat-send') as HTMLButtonElement | null
    if (input) { input.disabled = false; input.placeholder = 'Type a message...'; input.value = '' }
    if (sendBtn) sendBtn.disabled = false

    // Hide status bar
    const statusEl = this.container?.querySelector('#hn-chat-status') as HTMLElement | null
    if (statusEl) { statusEl.style.display = 'none'; statusEl.innerHTML = '' }

    // Show greeting
    this.appendGreeting(this.config.greeting)

    if (this.isOpen) input?.focus()
  }

  private scrollChatToBottom() {
    const list = this.container?.querySelector('#hn-chat-messages') as HTMLElement | null
    if (!list) return
    // Use requestAnimationFrame so layout has settled before we read scrollHeight
    requestAnimationFrame(() => {
      list.scrollTop = list.scrollHeight
    })
  }

  // ─── Theme ───────────────────────────────────────────────────────────────────

  private async applyWorkspaceTheme() {
    if (!this.container) return

    try {
      const url = `${this.config.baseUrl}/api/widget/theme?workspace=${encodeURIComponent(this.config.workspace)}`
      const res = await fetch(url, { cache: 'no-store' })
      if (!res.ok) return

      const data = await res.json() as ThemePayload
      if (data.vars && typeof data.vars === 'object') {
        for (const [key, value] of Object.entries(data.vars)) {
          if (!key.startsWith('--') || typeof value !== 'string') continue
          this.container.style.setProperty(key, value)
        }
      }

      if (Array.isArray(data.fontUrls)) {
        for (const fontUrl of data.fontUrls) {
          if (typeof fontUrl !== 'string' || fontUrl.length === 0) continue

          const existing = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).find(
            (link) => (link as HTMLLinkElement).href === fontUrl,
          )
          if (existing) continue

          const link = document.createElement('link')
          link.rel = 'stylesheet'
          link.href = fontUrl
          document.head.appendChild(link)
        }
      }

      const logoEl = this.container.querySelector('.hn-panel-logo') as HTMLImageElement | null
      const logoTextEl = this.container.querySelector('.hn-panel-logo-text') as HTMLSpanElement | null
      const brandText = typeof data.brandText === 'string' ? data.brandText.trim() : ''

      if (logoEl) {
        if (typeof data.logoUrl === 'string' && data.logoUrl.length > 0) {
          logoEl.src = data.logoUrl
          logoEl.style.display = 'block'
          if (logoTextEl) {
            logoTextEl.textContent = ''
            logoTextEl.style.display = 'none'
          }
        } else {
          logoEl.removeAttribute('src')
          logoEl.style.display = 'none'
          if (logoTextEl && brandText.length > 0) {
            logoTextEl.textContent = brandText
            logoTextEl.style.display = 'block'
          } else if (logoTextEl) {
            logoTextEl.textContent = ''
            logoTextEl.style.display = 'none'
          }
        }
      }
    } catch {
      // Keep default widget colors if theme fetch fails.
    } finally {
      if (this.container) this.container.style.opacity = '1'
    }
  }

  // ─── Markdown / HTML helpers (shared by both modes) ─────────────────────────

  private renderAnswerMarkdown(markdown: string): string {
    const lines = markdown.replace(/\r\n/g, '\n').split('\n')
    const html: string[] = []

    let inCode = false
    let codeLines: string[] = []
    let inUl = false
    let inOl = false
    let pendingListClose = false

    const closeLists = () => {
      pendingListClose = false
      if (inUl) { html.push('</ul>'); inUl = false }
      if (inOl) { html.push('</ol>'); inOl = false }
    }

    const flushCode = () => {
      if (!inCode) return
      html.push(`<pre><code>${this.escapeHtml(codeLines.join('\n'))}</code></pre>`)
      inCode = false
      codeLines = []
    }

    for (const rawLine of lines) {
      const line = rawLine ?? ''
      const trimmed = line.trim()

      if (trimmed.startsWith('```')) {
        closeLists()
        if (inCode) flushCode()
        else inCode = true
        continue
      }

      if (inCode) {
        codeLines.push(line)
        continue
      }

      if (trimmed.length === 0) {
        if (inUl || inOl) pendingListClose = true
        continue
      }

      if (pendingListClose) {
        pendingListClose = false
        const nextIsListItem = /^\s*[-*]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)
        if (!nextIsListItem) closeLists()
      }

      const ulMatch = line.match(/^\s*[-*]\s+(.+)$/)
      if (ulMatch) {
        if (inOl) { html.push('</ol>'); inOl = false }
        if (!inUl) { html.push('<ul>'); inUl = true }
        html.push(`<li>${this.renderInlineMarkdown(ulMatch[1] ?? '')}</li>`)
        continue
      }

      const olMatch = line.match(/^\s*\d+\.\s+(.+)$/)
      if (olMatch) {
        if (inUl) { html.push('</ul>'); inUl = false }
        if (!inOl) { html.push('<ol>'); inOl = true }
        html.push(`<li>${this.renderInlineMarkdown(olMatch[1] ?? '')}</li>`)
        continue
      }

      closeLists()

      const blockquoteMatch = line.match(/^\s*>\s?(.*)$/)
      if (blockquoteMatch) {
        html.push(`<blockquote>${this.renderInlineMarkdown(blockquoteMatch[1] ?? '')}</blockquote>`)
        continue
      }

      const headingMatch = line.match(/^\s*(#{1,3})\s+(.+)$/)
      if (headingMatch) {
        const level = headingMatch[1]?.length ?? 1
        const content = this.renderInlineMarkdown(headingMatch[2] ?? '')
        html.push(`<p class="hn-ai-h${Math.min(level, 3)}">${content}</p>`)
        continue
      }

      html.push(`<p>${this.renderInlineMarkdown(line)}</p>`)
    }

    flushCode()
    closeLists()

    return html.join('')
  }

  private renderInlineMarkdown(text: string): string {
    const codeTokens: string[] = []
    const linkTokens: string[] = []

    const withCodeTokens = text.replace(/`([^`]+)`/g, (_m, content: string) => {
      const token = `@@CODE${codeTokens.length}@@`
      codeTokens.push(`<code>${this.escapeHtml(content)}</code>`)
      return token
    })

    const withLinkTokens = withCodeTokens.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label: string, href: string) => {
      const safeHref = this.normalizeSafeHref(String(href).trim())
      const token = `@@LINK${linkTokens.length}@@`
      if (!safeHref) {
        linkTokens.push(this.escapeHtml(label))
        return token
      }
      linkTokens.push(
        `<a href="${this.escapeHtml(safeHref)}" target="_blank" rel="noopener noreferrer">${this.escapeHtml(label)}</a>`
      )
      return token
    })

    let out = this.escapeHtml(withLinkTokens)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')

    codeTokens.forEach((tokenHtml, i) => {
      out = out.replace(`@@CODE${i}@@`, () => tokenHtml)
    })
    linkTokens.forEach((tokenHtml, i) => {
      out = out.replace(`@@LINK${i}@@`, () => tokenHtml)
    })

    return out
  }

  private normalizeSafeHref(href: string): string | null {
    if (href.startsWith('/')) return href
    try {
      const parsed = new URL(href)
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return href
      return null
    } catch {
      return null
    }
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }
}
