import { getState, popView } from '../state'
import { renderHeader } from '../components/header'
import { renderMessage, renderTypingIndicator } from '../components/message-bubble'
import { ChatManager } from '../chat'
import type { ConversationMessage } from '../types'

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function getBaseUrl(): string {
  const { config } = getState()
  if (config) {
    const baseUrl = (config as unknown as Record<string, unknown>)._baseUrl as string | undefined
    if (baseUrl) return baseUrl
  }
  return window.location.origin
}

// Module-level state
let chatManager: ChatManager | null = null
let messages: ConversationMessage[] = []
let isStreaming = false
let streamingContent = ''
let rerender: (() => void) | null = null
let _initializedForConvId: string | null | undefined = undefined // undefined = never initialized

export function setChatRerender(fn: () => void): void {
  rerender = fn
}

export function getChatManager(): ChatManager | null {
  return chatManager
}

export function resetChatView(): void {
  chatManager?.stopPolling()
  chatManager = null
  messages = []
  isStreaming = false
  streamingContent = ''
  rerender = null
  _initializedForConvId = undefined
}

export async function initChatView(conversationId?: string, forceNew?: boolean): Promise<void> {
  const targetId = conversationId ?? null

  // Skip re-init only for same-conversation re-renders, never when forceNew
  if (!forceNew && chatManager !== null && _initializedForConvId === targetId) return

  _initializedForConvId = targetId
  messages = []
  isStreaming = false
  streamingContent = ''

  const { config } = getState()
  if (!config) return

  const baseUrl = getBaseUrl()

  chatManager = new ChatManager({ workspace: config.slug, baseUrl })

  if (conversationId) {
    chatManager.setSession(conversationId)
    const loaded = await chatManager.loadMessages()
    messages = loaded
  } else if (!forceNew) {
    const resumed = await chatManager.resumeSession()
    if (resumed) {
      const loaded = await chatManager.loadMessages()
      messages = loaded
    }
  }

  chatManager.setOnNewMessages((newMsgs) => {
    messages = [...messages, ...newMsgs]
    rerender?.()
  })
}

export function renderChat(): string {
  const { config } = getState()
  if (!config) return ''

  const workspaceName = escapeHtml(config.name)
  const baseUrl = getBaseUrl()
  // config.helpCenterUrl is set by the server; baseUrl is a last-resort fallback (same host)
  const helpCenterUrl = config.helpCenterUrl ?? baseUrl

  const messagesHtml = messages
    .map((msg) => renderMessage(msg, helpCenterUrl, baseUrl))
    .join('')

  const showTyping = isStreaming && streamingContent === ''
  const streamingBubble = isStreaming && streamingContent !== ''
    ? `<div class="hn-msg hn-msg-ai hn-msg-left">
        <div class="hn-msg-bubble">${escapeHtml(streamingContent)}</div>
      </div>`
    : ''

  const customerMsgCount = messages.filter((m) => m.role === 'CUSTOMER').length
  const showEscalate = !isStreaming && customerMsgCount >= 3
    && chatManager?.getState() === 'CHAT_AI'

  const escalateBtn = showEscalate
    ? `<div class="hn-chat-escalate-wrap">
        <button class="hn-chat-escalate-btn" type="button" data-action="escalate">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
          </svg>
          Talk to a human
        </button>
      </div>`
    : ''

  const composerDisabled = isStreaming || chatManager?.getState() === 'RESOLVED' ? 'disabled' : ''
  const composerPlaceholder = chatManager?.getState() === 'RESOLVED'
    ? 'This conversation is resolved.'
    : 'Type a message…'

  const logoHtml = config.logo
    ? `<img class="hn-chat-header-logo" src="${config.logo}" alt="" />`
    : `<span class="hn-chat-header-logo-fallback">${workspaceName.charAt(0)}</span>`

  const responseTime = config.widgetResponseTime
    ? `<span class="hn-chat-header-status">${escapeHtml(config.widgetResponseTime)}</span>`
    : ''

  const greetingHtml = messages.length === 0
    ? `<div class="hn-chat-greeting">${escapeHtml(config.aiGreeting || 'Ask us anything, or share your feedback.')}</div>`
    : ''

  return `
    <div class="hn-view hn-view-chat">
      <div class="hn-chat-header">
        <button class="hn-header-back" type="button" aria-label="Go back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        ${logoHtml}
        <div class="hn-chat-header-info">
          <span class="hn-chat-header-name">${workspaceName}</span>
          ${responseTime}
        </div>
        <button class="hn-header-close" type="button" aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="hn-chat-messages" id="hn-chat-messages-area">
        <div class="hn-chat-spacer"></div>
        ${greetingHtml}
        ${messagesHtml}
        ${showTyping ? renderTypingIndicator() : ''}
        ${streamingBubble}
      </div>
      ${escalateBtn}
      <div class="hn-chat-composer">
        <div class="hn-chat-composer-card">
          <textarea
            class="hn-chat-input"
            id="hn-chat-input"
            rows="1"
            maxlength="1000"
            placeholder="${escapeHtml(composerPlaceholder)}"
            autocomplete="off"
            spellcheck="false"
            ${composerDisabled}
          ></textarea>
          <button class="hn-chat-send" id="hn-chat-send" type="button" aria-label="Send" ${composerDisabled}>
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="16" height="16">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  `
}

export function bindChatEvents(container: HTMLElement, rerenderFn: () => void): void {
  rerender = rerenderFn

  const input = container.querySelector('#hn-chat-input') as HTMLTextAreaElement | null
  const sendBtn = container.querySelector('#hn-chat-send') as HTMLButtonElement | null

  const submit = () => {
    const text = input?.value.trim() ?? ''
    if (!text || isStreaming) return
    void sendMessage(text, input)
  }

  sendBtn?.addEventListener('click', submit)

  input?.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return
    e.preventDefault()
    submit()
  })

  input?.addEventListener('input', () => {
    if (!input) return
    input.style.height = 'auto'
    input.style.height = Math.min(input.scrollHeight, 96) + 'px'
  })

  container.querySelector('[data-action="escalate"]')?.addEventListener('click', () => {
    void handleEscalate(rerenderFn)
  })

  container.querySelector('.hn-header-back')?.addEventListener('click', () => {
    popView()
  })

  container.querySelector('.hn-header-close')?.addEventListener('click', () => {
    container.dispatchEvent(new CustomEvent('hn:close', { bubbles: true }))
  })

  // Feedback buttons on AI messages
  container.querySelectorAll('.hn-msg-feedback').forEach((feedbackEl) => {
    const messageId = (feedbackEl as HTMLElement).dataset.messageId
    if (!messageId) return
    feedbackEl.querySelectorAll('.hn-msg-fb-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const helpful = (btn as HTMLElement).dataset.fb === 'true'
        void chatManager?.sendFeedback(messageId, helpful)
        feedbackEl.querySelectorAll('.hn-msg-fb-btn').forEach((b) => {
          (b as HTMLButtonElement).disabled = true
        })
      })
    })
  })

  scrollToBottom(container)
}

function scrollToBottom(container: HTMLElement): void {
  const area = container.querySelector('#hn-chat-messages-area') as HTMLElement | null
  if (!area) return
  requestAnimationFrame(() => {
    area.scrollTop = area.scrollHeight
  })
}

async function sendMessage(text: string, input: HTMLTextAreaElement | null): Promise<void> {
  // Capture manager instance — module var may be nulled by resetChatView while async
  const manager = chatManager
  if (!manager) return

  if (input) {
    input.value = ''
    input.style.height = 'auto'
  }

  isStreaming = true
  streamingContent = ''

  const customerMsg: ConversationMessage = {
    id: `local_${Date.now()}`,
    role: 'CUSTOMER',
    content: text,
    createdAt: new Date().toISOString(),
  }
  messages = [...messages, customerMsg]
  rerender?.()

  try {
    if (!manager.getSession()) {
      await manager.createConversation()
    }

    for await (const event of manager.sendMessage(text)) {
      // User navigated away — abort cleanly
      if (chatManager === null) return

      if (event.type === 'text') {
        streamingContent += event.text
        rerender?.()
      } else if (event.type === 'sources') {
        // sources included when reloading after done
      } else if (event.type === 'done') {
        manager.advanceLastMessageAt()
        const loaded = await manager.loadMessages()
        if (chatManager === null) return  // navigated away during load
        messages = loaded
        isStreaming = false
        streamingContent = ''
        rerender?.()
        return
      } else if (event.type === 'error') {
        const errorMsg: ConversationMessage = {
          id: `error_${Date.now()}`,
          role: 'SYSTEM',
          content: event.message ?? 'Something went wrong. Please try again.',
          createdAt: new Date().toISOString(),
        }
        messages = [...messages, errorMsg]
        isStreaming = false
        streamingContent = ''
        rerender?.()
        return
      }
    }
  } catch (err) {
    if (chatManager === null) return
    const errorMsg: ConversationMessage = {
      id: `error_${Date.now()}`,
      role: 'SYSTEM',
      content: err instanceof Error ? err.message : 'Failed to send message',
      createdAt: new Date().toISOString(),
    }
    messages = [...messages, errorMsg]
    isStreaming = false
    streamingContent = ''
    rerender?.()
  }
}

async function handleEscalate(rerenderFn: () => void): Promise<void> {
  const manager = chatManager
  if (!manager) return

  if (!manager.getSession()) {
    try {
      await manager.createConversation()
    } catch {
      const errorMsg: ConversationMessage = {
        id: `error_${Date.now()}`,
        role: 'SYSTEM',
        content: 'Unable to connect. Please try again.',
        createdAt: new Date().toISOString(),
      }
      messages = [...messages, errorMsg]
      rerenderFn()
      return
    }
  }

  const connectingMsg: ConversationMessage = {
    id: `sys_${Date.now()}`,
    role: 'SYSTEM',
    content: 'Connecting you to a support agent…',
    createdAt: new Date().toISOString(),
  }
  messages = [...messages, connectingMsg]
  rerenderFn()

  try {
    await manager.escalate()
    rerenderFn()
  } catch {
    if (chatManager === null) return
    const errorMsg: ConversationMessage = {
      id: `error_${Date.now()}`,
      role: 'SYSTEM',
      content: 'Failed to connect to support. Please try again.',
      createdAt: new Date().toISOString(),
    }
    messages = [...messages, errorMsg]
    rerenderFn()
  }
}
